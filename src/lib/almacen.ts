import { promises as fs } from "fs";
import path from "path";

/**
 * Donde se guardan los leads y los negocios nuevos.
 *
 * En el Mac vale un JSON al lado. En Vercel no: alli el disco es de solo
 * lectura y cualquier escritura revienta, que es justo por lo que la
 * herramienta dejo de funcionar en produccion. Si estan puestas LEAD_API_URL y
 * LEAD_API_TOKEN, todo va al endpoint del hosting y entonces el Mac y Vercel
 * ven exactamente los mismos datos.
 */

const API = process.env.LEAD_API_URL || "";
const TOKEN = process.env.LEAD_API_TOKEN || "";
export const enServidor = Boolean(API && TOKEN);

const DATA_DIR = path.join(process.cwd(), "data");

let cola: Promise<unknown> = Promise.resolve();
export function enFila<T>(fn: () => Promise<T>): Promise<T> {
  const corre = cola.then(fn, fn);
  cola = corre.catch(() => {});
  return corre;
}

async function pedir(camino: string, opciones: RequestInit = {}) {
  const r = await fetch(API + camino, {
    ...opciones,
    headers: { "Content-Type": "application/json", "X-Lead-Token": TOKEN, ...(opciones.headers || {}) },
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `El almacen contesto ${r.status}`);
  return d;
}

function fichero(coleccion: string) {
  return path.join(DATA_DIR, `${coleccion}.json`);
}

export async function leer<T>(coleccion: string): Promise<T[]> {
  if (enServidor) {
    const d = await pedir(`?coleccion=${encodeURIComponent(coleccion)}`);
    return (d.filas || []) as T[];
  }
  try {
    const texto = await fs.readFile(fichero(coleccion), "utf-8");
    return texto ? (JSON.parse(texto) as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Guarda la lista entera. En el servidor se manda en un solo viaje. */
export async function escribir<T extends { id: string }>(coleccion: string, filas: T[]) {
  if (enServidor) {
    await pedir("?accion=lote", {
      method: "POST",
      body: JSON.stringify({ coleccion, filas: filas.map((f) => ({ id: f.id, datos: f })) }),
    });
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${fichero(coleccion)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(filas, null, 2));
  await fs.rename(tmp, fichero(coleccion));
}

/** Guarda una sola fila (en el servidor no hace falta reescribir el resto). */
export async function guardarUna<T extends { id: string }>(coleccion: string, fila: T, todas: T[]) {
  if (enServidor) {
    await pedir("", { method: "POST", body: JSON.stringify({ coleccion, id: fila.id, datos: fila }) });
    return;
  }
  await escribir(coleccion, todas);
}

export async function borrarUna<T extends { id: string }>(coleccion: string, id: string, todas: T[]) {
  if (enServidor) {
    await pedir("?accion=borrar", { method: "POST", body: JSON.stringify({ coleccion, id }) });
    return;
  }
  await escribir(coleccion, todas.filter((f) => f.id !== id));
}
