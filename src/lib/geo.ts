import axios from "axios";
import { promises as fs } from "fs";
import path from "path";

/**
 * Situar un pueblo en el mapa para saber si cae cerca. Se pregunta al buscador
 * de swisstopo (gratis, sin clave) y se guarda lo que contesta en un fichero,
 * porque los pueblos no se mueven y asi no se le pregunta dos veces por lo mismo.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE = path.join(DATA_DIR, "lugares.json");

export interface Punto { lat: number; lon: number; }

type Cache = Record<string, Punto | null>;

async function leerCache(): Promise<Cache> {
  try {
    return JSON.parse(await fs.readFile(CACHE, "utf-8"));
  } catch {
    return {};
  }
}

async function escribirCache(c: Cache) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${CACHE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(c, null, 2));
  await fs.rename(tmp, CACHE);
}

/** Quita el canton entre parentesis: "Oberriet (SG)" -> "Oberriet". */
export function limpiarLocalidad(t: string): string {
  return t.replace(/\s*\([A-Z]{2}\)\s*$/, "").replace(/\s+/g, " ").trim();
}

/**
 * El canton NO es un adorno: "Buchs" a secas se lo lleva swisstopo a Buchs (ZH),
 * a 85 km, y el pueblo de al lado desaparece de la lista. Siempre con canton.
 */
export async function situar(localidad: string, canton = ""): Promise<Punto | null> {
  const pueblo = limpiarLocalidad(localidad);
  const cantonTitulo = localidad.match(/\(([A-Z]{2})\)\s*$/)?.[1] ?? "";
  const cant = cantonTitulo || canton;
  const clave = `${pueblo} ${cant}`.trim().toLowerCase();
  if (!pueblo) return null;

  const cache = await leerCache();
  if (clave in cache) return cache[clave];

  let punto: Punto | null = null;
  try {
    const url = "https://api3.geo.admin.ch/rest/services/ech/SearchServer";
    const res = await axios.get(url, {
      timeout: 12000,
      params: {
        searchText: clave,
        type: "locations",
        origins: "gg25,zipcode",
        limit: 5,
        sr: 4326,
      },
    });
    // Solo vale si lo que contesta empieza por el pueblo que hemos pedido:
    // este buscador es muy laxo y a "Eier" responde "Meierskappel".
    const llano = (t: string) =>
      t.replace(/<[^>]+>/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const a = (res.data?.results ?? [])
      .map((r: { attrs?: { lat?: number; lon?: number; label?: string; origin?: string } }) => r.attrs)
      .find(
        (x: { lat?: number; lon?: number; label?: string } | undefined) =>
          x && typeof x.lat === "number" && typeof x.lon === "number" &&
          llano(x.label ?? "").startsWith(llano(pueblo))
      );
    if (a) punto = { lat: a.lat as number, lon: a.lon as number };
  } catch {
    return null;   // sin red o sin respuesta: no se guarda, se reintenta luego
  }

  cache[clave] = punto;
  await escribirCache(cache);
  return punto;
}

/** Distancia en linea recta, en kilometros. */
export function km(a: Punto, b: Punto): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

/** Desde donde se mide todo: Sevelen. */
export async function casa(): Promise<Punto> {
  return (await situar("Sevelen")) ?? { lat: 47.1155, lon: 9.4806 };
}

/**
 * Situar una direccion de calle exacta. Hace falta porque el centro de un
 * municipio o de un codigo postal cae donde cae: el de Sevelen sale en Windegg,
 * monte arriba, y desde alli el ruteo daba 26 minutos hasta Buchs en vez de 11.
 */
export async function situarDireccion(texto: string): Promise<Punto | null> {
  const clave = `@${texto.replace(/\s+/g, " ").trim().toLowerCase()}`;
  if (clave.length < 8) return null;

  const cache = await leerCache();
  if (clave in cache) return cache[clave];

  let punto: Punto | null = null;
  try {
    const res = await axios.get("https://api3.geo.admin.ch/rest/services/ech/SearchServer", {
      timeout: 12000,
      params: { searchText: texto, type: "locations", origins: "address", limit: 1, sr: 4326 },
    });
    const a = res.data?.results?.[0]?.attrs;
    if (a && typeof a.lat === "number" && typeof a.lon === "number") punto = { lat: a.lat, lon: a.lon };
  } catch {
    return null;
  }

  cache[clave] = punto;
  await escribirCache(cache);
  return punto;
}

/**
 * Minutos en coche entre dos puntos, por carretera (OSRM, publico y sin clave).
 * Si no contesta se devuelve null y arriba se tira de la distancia en linea
 * recta: mas vale una lista con algun pueblo de mas que ninguna lista.
 */
export async function minutosEnCoche(a: Punto, b: Punto): Promise<number | null> {
  const clave = `~${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;
  const cache = await leerCache();
  if (clave in cache) {
    const g = cache[clave] as unknown as { min?: number } | null;
    return g && typeof g.min === "number" ? g.min : null;
  }

  let min: number | null = null;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}`;
    const res = await axios.get(url, { timeout: 15000, params: { overview: "false" } });
    const d = res.data?.routes?.[0]?.duration;
    if (typeof d === "number") min = Math.round(d / 60);
  } catch {
    return null;
  }

  if (min !== null) {
    cache[clave] = { min } as unknown as Punto;
    await escribirCache(cache);
  }
  return min;
}

/**
 * Desde donde sale Andrea. Se puede cambiar poniendo BASE_ADDRESS en .env.local
 * (por ejemplo "Bahnhofstrasse 1, 9470 Buchs SG"); si no, el centro de Sevelen.
 */
export async function base(): Promise<Punto> {
  const dir = process.env.BASE_ADDRESS;
  if (dir) {
    const p = await situarDireccion(dir);
    if (p) return p;
  }
  return { lat: 47.1122, lon: 9.4902 };
}
