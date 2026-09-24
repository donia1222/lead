import { NextResponse } from "next/server";
import axios from "axios";
import { promises as fs } from "fs";
import path from "path";
import { enElHosting, leer } from "@/lib/almacen";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Para saber que se puede y que no desde donde este corriendo esto (el Mac o
 * Vercel). Sin esto, arreglar el almacenamiento seria trabajar a ciegas: si
 * local.ch bloquea a los centros de datos, no hay nada que arreglar.
 */

const HTTP = {
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  validateStatus: () => true,
};

async function mirar(que: string, url: string) {
  const t = Date.now();
  try {
    const r = await axios.get(url, HTTP);
    // Una respuesta JSON no llega como texto: hay que medirla igual, o
    // parece que ha fallado cuando ha ido bien.
    const largo = typeof r.data === "string" ? r.data.length : JSON.stringify(r.data ?? "").length;
    return { que, ok: r.status === 200 && largo > 500, estado: r.status, tamano: largo, ms: Date.now() - t };
  } catch (e) {
    return { que, ok: false, estado: 0, tamano: 0, ms: Date.now() - t, fallo: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const pruebas = [
    await mirar("local.ch (la guia de la que salen los negocios)", "https://www.local.ch/de/q/Buchs%20SG/restaurant"),
    await mirar("una web cualquiera de cliente", "https://www.buchserhof.ch"),
    await mirar("el boletin oficial SHAB", "https://www.shab.ch/api/v1/publications?publicationStates=PUBLISHED&subRubrics=HR01&cantons=SG&pageRequest.size=1"),
  ];

  // ¿Se puede escribir en disco donde vive esto?
  let disco: { ok: boolean; donde: string; fallo?: string };
  const donde = path.join(process.cwd(), "data");
  try {
    await fs.mkdir(donde, { recursive: true });
    const f = path.join(donde, ".prueba");
    await fs.writeFile(f, "x");
    await fs.unlink(f);
    disco = { ok: true, donde };
  } catch (e) {
    disco = { ok: false, donde, fallo: e instanceof Error ? e.message : String(e) };
  }

  // El almacen: ¿esta puesto el endpoint del hosting y contesta?
  let almacen: { donde: string; ok: boolean; leads?: number; fallo?: string };
  if (enElHosting()) {
    try {
      const filas = await leer<{ id: string }>("leads");
      almacen = { donde: "endpoint del hosting", ok: true, leads: filas.length };
    } catch (e) {
      almacen = { donde: "endpoint del hosting", ok: false, fallo: e instanceof Error ? e.message : String(e) };
    }
  } else {
    almacen = { donde: "sin codigo de sesion: usaria el fichero local", ok: !process.env.VERCEL };
  }

  return NextResponse.json({
    donde: process.env.VERCEL ? `Vercel (${process.env.VERCEL_REGION ?? "?"})` : "este ordenador",
    clave_openai: process.env.OPENAI_API_KEY ? "puesta" : "FALTA",
    codigo_acceso: process.env.ACCESS_CODE ? "puesto" : "sin codigo",
    almacen,
    escribir_en_disco: disco,
    alcanza: pruebas,
  });
}
