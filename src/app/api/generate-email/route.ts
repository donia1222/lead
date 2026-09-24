import { NextRequest, NextResponse } from "next/server";
import { BASE, credencial } from "@/lib/almacen";
import { updateLead } from "@/lib/leads-store";

export const maxDuration = 60;

/** El email lo redacta el hosting, que es donde vive la clave de OpenAI. */
export async function POST(req: NextRequest) {
  const { id, name, city, sector, problems, customPrompt } = await req.json();
  if (!name) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const codigo = credencial();
  if (!codigo) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  try {
    const r = await fetch(`${BASE}/email.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lead-Codigo": codigo },
      body: JSON.stringify({
        accion: "generar", nombre: name, ciudad: city, sector,
        problemas: problems ?? [], extra: customPrompt ?? "",
      }),
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok) return NextResponse.json({ error: d?.error || `El servidor contesto ${r.status}` }, { status: 502 });
    if (id) await updateLead(id, { emailDraft: d.email });
    return NextResponse.json({ email: d.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin conexion" }, { status: 502 });
  }
}
