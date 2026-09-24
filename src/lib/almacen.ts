import { promises as fs } from "fs";
import path from "path";
import { cookies } from "next/headers";

/**
 * Donde se guardan los leads y los negocios nuevos.
 *
 * En el Mac vale un JSON al lado. En Vercel no: alli el disco es de solo
 * lectura y cualquier escritura revienta, que es justo por lo que la
 * herramienta dejo de funcionar en produccion. Si estan puestas LEAD_API_URL y
 * LEAD_API_TOKEN, todo va al endpoint del hosting y entonces el Mac y Vercel
 * ven exactamente los mismos datos.
 */

/** Donde vive el backend. No es secreto, asi que va escrito aqui. */
export const BASE = process.env.LEAD_API_URL || "https://web.lweb.ch/lead/phps";
const API = `${BASE}/lead.php`;

/**
 * La credencial. En el servidor de Vercel no hay variables de entorno a
 * proposito: se usa el mismo codigo que escribes al entrar, que viaja en la
 * cookie de la sesion. En el Mac se puede poner LEAD_API_TOKEN y listo.
 */
export function credencial(): string {
  const env = process.env.LEAD_API_TOKEN;
  if (env) return env;
  try {
    return cookies().get("lead-auth")?.value || "";
  } catch {
    return "";
  }
}

/** Si no hay credencial no se puede hablar con el hosting: se usa el fichero. */
export function enElHosting(): boolean {
  return Boolean(credencial());
}

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
    headers: { "Content-Type": "application/json", "X-Lead-Codigo": credencial(), ...(opciones.headers || {}) },
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
  if (enElHosting()) {
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
  if (enElHosting()) {
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
  if (enElHosting()) {
    await pedir("", { method: "POST", body: JSON.stringify({ coleccion, id: fila.id, datos: fila }) });
    return;
  }
  await escribir(coleccion, todas);
}

export async function borrarUna<T extends { id: string }>(coleccion: string, id: string, todas: T[]) {
  if (enElHosting()) {
    await pedir("?accion=borrar", { method: "POST", body: JSON.stringify({ coleccion, id }) });
    return;
  }
  await escribir(coleccion, todas.filter((f) => f.id !== id));
}
