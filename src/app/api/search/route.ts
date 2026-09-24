import { NextRequest, NextResponse } from "next/server";
import { BASE, credencial } from "@/lib/almacen";
import { getLeads, saveLead } from "@/lib/leads-store";
import { Lead } from "@/lib/types";

export const maxDuration = 120;

/**
 * La busqueda ya no se hace aqui: la hace buscar.php en el hosting. Alli hay
 * tiempo de sobra, la clave de OpenAI vive en secure_config y el raspado sale
 * desde una IP suiza, que es lo que local.ch espera ver.
 */
function dominio(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export async function POST(req: NextRequest) {
  const { query, sector, city } = await req.json();
  const que = (sector || query || "").trim();
  const ciudad = (city || "").trim();
  if (!que || !ciudad) {
    return NextResponse.json({ error: "Falta el sector o la ciudad" }, { status: 400 });
  }

  const codigo = credencial();
  if (!codigo) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  const existentes = await getLeads();
  const dominios = existentes.filter((l) => l.url).map((l) => dominio(l.url));

  let datos: { leads?: Lead[]; error?: string };
  try {
    const r = await fetch(`${BASE}/buscar.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lead-Codigo": codigo },
      body: JSON.stringify({ sector: que, ciudad, cuantos: 6, dominios }),
      cache: "no-store",
    });
    datos = await r.json();
    if (!r.ok) return NextResponse.json({ error: datos?.error || `El servidor contesto ${r.status}` }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin conexion con el servidor" }, { status: 502 });
  }

  const leads = datos.leads || [];
  for (const l of leads) await saveLead(l);

  return NextResponse.json({
    leads,
    message: leads.length
      ? `${leads.length} nuevos leads analizados`
      : "No se encontraron negocios nuevos para esa búsqueda",
  });
}
