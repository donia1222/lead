import { NextRequest, NextResponse } from "next/server";
import { BASE, credencial } from "@/lib/almacen";
import { saveLead } from "@/lib/leads-store";
import { Lead } from "@/lib/types";

export const maxDuration = 60;

/** Analizar una web suelta. Tambien lo hace el hosting. */
export async function POST(req: NextRequest) {
  const { name, sector, city, url } = await req.json();
  if (!url || !name) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const codigo = credencial();
  if (!codigo) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  try {
    const r = await fetch(`${BASE}/buscar.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lead-Codigo": codigo },
      body: JSON.stringify({ url, nombre: name, sector, ciudad: city }),
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok || !d.lead) {
      return NextResponse.json({ error: d?.error || `El servidor contesto ${r.status}` }, { status: 502 });
    }
    const lead = d.lead as Lead;
    await saveLead(lead);
    return NextResponse.json(lead);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin conexion" }, { status: 502 });
  }
}
