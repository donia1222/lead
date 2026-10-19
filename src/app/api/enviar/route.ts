import { NextRequest, NextResponse } from "next/server";
import { BASE, credencial } from "@/lib/almacen";
import { updateLead } from "@/lib/leads-store";

export const maxDuration = 60;

/**
 * Mandar el email del lead. Quien lo manda de verdad es enviar.php en el
 * hosting, que es donde esta el buzon: asi el correo sale firmado por el
 * dominio y no cae en no deseado. Aqui solo se pasa el recado y, si ha salido,
 * se apunta el lead como contactado.
 */
export async function POST(req: NextRequest) {
  const { id, para, nombre, asunto, texto } = await req.json();
  if (!para || !texto) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const codigo = credencial();
  if (!codigo) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  try {
    const r = await fetch(`${BASE}/enviar.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lead-Codigo": codigo },
      body: JSON.stringify({ para, nombre: nombre ?? "", asunto: asunto ?? "", texto }),
      cache: "no-store",
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) {
      return NextResponse.json(
        { error: d?.error || `El servidor contesto ${r.status}` },
        { status: r.status === 401 ? 401 : 502 }
      );
    }
    // Se apunta despues de que el correo haya salido, nunca antes: si el envio
    // falla, el lead tiene que seguir pendiente.
    if (id) await updateLead(id, { status: "contacted", enviadoEn: new Date().toISOString() });
    return NextResponse.json({ ok: true, para: d.para, asunto: d.asunto });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin conexion" }, { status: 502 });
  }
}
