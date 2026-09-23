import axios from "axios";
import { Nuevo } from "./types";
import { base, km, limpiarLocalidad, minutosEnCoche, situar, situarDireccion } from "./geo";

/**
 * Altas del registro de comercio, del boletin oficial suizo (SHAB/FOSC).
 * Es publico y abierto: no hace falta clave ni registro. Cada dia laborable se
 * publica quien se ha dado de alta, con nombre, direccion y numero de empresa.
 * Aqui solo miramos la sub-rubrica HR01, que son las inscripciones NUEVAS.
 *
 * Ojo: el boletin es suizo. Liechtenstein tiene su propio registro y no sale
 * aqui.
 */

const API = "https://www.shab.ch/api/v1/publications";
const HTTP = { timeout: 30000, headers: { Accept: "application/json" } };

export interface OpcionesAltas {
  cantones?: string[];   // por defecto St. Gallen
  dias?: number;         // cuantos dias hacia atras
  minutos?: number;      // cuanto se esta dispuesto a conducir
  limite?: number;       // tope de altas a mirar
}

interface Publicacion {
  meta: {
    id: string;
    publicationNumber: string;
    publicationDate: string;
    title: { de: string };
  };
}

/** "Neueintragung LeNail, Inh. Weiss, Oberriet (SG)" -> nombre + localidad. */
export function partirTitulo(titulo: string): { nombre: string; localidad: string } {
  const t = titulo.replace(/^Neueintragung\s+/i, "").trim();
  const corte = t.lastIndexOf(",");
  if (corte < 0) return { nombre: t, localidad: "" };
  return {
    nombre: t.slice(0, corte).trim(),
    localidad: t.slice(corte + 1).trim(),
  };
}

/** Del texto completo saca calle, codigo postal, forma juridica y proposito. */
export function leerDetalle(xml: string): {
  direccion: string;
  plz: string;
  uid: string;
  forma: string;
  proposito: string;
} {
  const texto = xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  const uid = texto.match(/CHE-[\d.]+/)?.[0] ?? "";
  const dir = texto.match(/CHE-[\d.]+,\s*([^,]+),\s*(\d{4})\s+([^,]+?),\s*([^,.]+)/);
  const prop =
    texto.match(/Zweck:\s*([^.]{10,400}\.)/)?.[1] ??
    texto.match(/bezweckt\s+([^.]{10,400}\.)/)?.[1] ??
    "";

  return {
    direccion: dir?.[1]?.trim() ?? "",
    plz: dir?.[2] ?? "",
    uid,
    forma: dir?.[4]?.trim() ?? "",
    proposito: prop.trim(),
  };
}

export async function buscarAltas(o: OpcionesAltas = {}): Promise<Nuevo[]> {
  const cantones = o.cantones?.length ? o.cantones : ["SG"];
  const dias = o.dias ?? 14;
  const minutos = o.minutos ?? 15;
  const limite = o.limite ?? 400;

  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    publicationStates: "PUBLISHED",
    subRubrics: "HR01",
    "publicationDate.start": desde,
    "pageRequest.page": "0",
    "pageRequest.size": String(limite),
  });
  cantones.forEach((c) => params.append("cantons", c));

  console.log(`[SHAB] Altas desde ${desde} en ${cantones.join(", ")}...`);
  const res = await axios.get(`${API}?${params.toString()}`, HTTP);
  const lista: Publicacion[] = res.data?.content ?? [];
  console.log(`[SHAB] ${lista.length} altas en el boletin`);

  const aqui = await base();
  const nuevos: Nuevo[] = [];

  // Un minuto de coche son como mucho ~1,5 km en linea recta por estos valles;
  // se deja margen de sobra en el filtro barato y luego se mide de verdad.
  const cribaKm = minutos * 2;

  for (const p of lista) {
    const { nombre, localidad } = partirTitulo(p.meta.title?.de ?? "");
    if (!nombre) continue;

    const puntoPueblo = await situar(localidad, cantones[0]);
    if (!puntoPueblo) continue;                   // sin situar, no se decide
    if (km(aqui, puntoPueblo) > cribaKm) continue; // ni de lejos: fuera

    // Solo ahora, con los pocos que quedan, se pide el texto completo.
    let detalle = { direccion: "", plz: "", uid: "", forma: "", proposito: "" };
    try {
      const xml = await axios.get(`${API}/${p.meta.id}/xml`, { timeout: 20000 });
      detalle = leerDetalle(String(xml.data));
    } catch {
      // sin detalle nos quedamos con lo del titulo
    }

    // Con la calle exacta se puede medir el trayecto de verdad.
    const puntoExacto = detalle.direccion
      ? await situarDireccion(`${detalle.direccion}, ${detalle.plz} ${limpiarLocalidad(localidad)}`)
      : null;
    const destino = puntoExacto ?? puntoPueblo;
    const enCoche = await minutosEnCoche(aqui, destino);
    const distancia = km(aqui, destino);

    // Si el ruteo no contesta, se decide por distancia en linea recta.
    if (enCoche !== null ? enCoche > minutos : distancia > minutos) continue;

    nuevos.push({
      id: p.meta.publicationNumber,
      nombre,
      localidad: limpiarLocalidad(localidad),
      plz: detalle.plz,
      direccion: detalle.direccion,
      uid: detalle.uid,
      forma: detalle.forma,
      proposito: detalle.proposito,
      fecha: (p.meta.publicationDate ?? "").slice(0, 10),
      km: distancia,
      minutos: enCoche,
      web: "",
      email: "",
      telefono: "",
      webComprobada: false,
      estado: "nuevo",
      nota: "",
      creadoEn: new Date().toISOString(),
    });
  }

  console.log(`[SHAB] ${nuevos.length} a menos de ${minutos} min en coche`);
  return nuevos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
