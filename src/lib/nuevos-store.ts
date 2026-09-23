import { promises as fs } from "fs";
import path from "path";
import { Nuevo } from "./types";

/** Igual que los leads: un JSON al lado, sin base de datos. */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "nuevos.json");

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function leer(): Promise<Nuevo[]> {
  try {
    const data = await fs.readFile(FILE, "utf-8");
    return data ? JSON.parse(data) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function escribir(lista: Nuevo[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2));
  await fs.rename(tmp, FILE);
}

export async function getNuevos(): Promise<Nuevo[]> {
  return leer();
}

/**
 * Mete los que aun no estaban y deja en paz los que ya tenias: lo que hayas
 * marcado como visitado o descartado, y tus notas, no se pisan al refrescar.
 */
export async function fusionar(entrantes: Nuevo[]): Promise<Nuevo[]> {
  return withLock(async () => {
    const actuales = await leer();
    const porId = new Map(actuales.map((n) => [n.id, n]));
    const recien: Nuevo[] = [];

    for (const n of entrantes) {
      const viejo = porId.get(n.id);
      if (viejo) {
        porId.set(n.id, { ...n, estado: viejo.estado, nota: viejo.nota, web: viejo.web, email: viejo.email, telefono: viejo.telefono, webComprobada: viejo.webComprobada, creadoEn: viejo.creadoEn });
      } else {
        porId.set(n.id, n);
        recien.push(n);
      }
    }

    const todos = [...porId.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
    await escribir(todos);
    return recien;
  });
}

export async function actualizarNuevo(id: string, cambios: Partial<Nuevo>) {
  return withLock(async () => {
    const lista = await leer();
    const i = lista.findIndex((n) => n.id === id);
    if (i >= 0) {
      lista[i] = { ...lista[i], ...cambios };
      await escribir(lista);
    }
  });
}
