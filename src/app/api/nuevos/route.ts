import { NextRequest, NextResponse } from "next/server";
import { BASE, credencial } from "@/lib/almacen";
import { actualizarNuevo, fusionar, getNuevos } from "@/lib/nuevos-store";
import { Nuevo } from "@/lib/types";

export const maxDuration = 120;

/**
 * El trabajo lo hace nuevos.php en el hosting: el boletin oficial, situar cada
 * direccion, los minutos en coche y mirar si tiene web. Aqui solo se junta con
 * lo que ya habia guardado, sin pisar notas ni visitas.
 */
export async function GET() {
  return NextResponse.json({ nuevos: await getNuevos() });
}

export async function POST(req: NextRequest) {
  const { dias, minutos, cantones } = await req.json().catch(() => ({}));
  const ventana = Number(dias) || 30;
  const cerca = Number(minutos) || 15;

  const codigo = credencial();
  if (!codigo) return NextResponse.json({ error: "Sin sesion" }, { status: 401 });

  const actuales = await getNuevos();

  let datos: { nuevos?: Nuevo[]; error?: string; enElBoletin?: number; pendientes?: number; segundos?: number };
  try {
    const r = await fetch(`${BASE}/nuevos.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lead-Codigo": codigo },
      body: JSON.stringify({
        dias: ventana,
        minutos: cerca,
        cantones: Array.isArray(cantones) && cantones.length ? cantones : ["SG"],
        // Los que ya tiene: el servidor ni los mira, y asi va mucho mas rapido.
        yaTengo: actuales.map((n) => n.id),
      }),
      cache: "no-store",
    });
    datos = await r.json();
    if (!r.ok) return NextResponse.json({ error: datos?.error || `El servidor contesto ${r.status}` }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sin conexion" }, { status: 502 });
  }

  const recien = await fusionar(datos.nuevos || []);
  const pendientes = Number(datos.pendientes || 0);
  const enElBoletin = Number(datos.enElBoletin || 0);

  // Cuando no sale nada conviene decir por que: casi siempre es que en esos
  // dias no se ha inscrito nadie cerca, no que algo se haya roto.
  const nada = `En los últimos ${ventana} días no hay ninguna alta a menos de ${cerca} min` +
    (enElBoletin ? ` (se han mirado ${enElBoletin} del boletín). Prueba con más días.` : ".");

  return NextResponse.json({
    nuevos: await getNuevos(),
    recien: recien.length,
    pendientes,
    mensaje: pendientes
      ? `${recien.length} traídos · quedan ${pendientes} por mirar…`
      : recien.length
        ? `${recien.length} negocios nuevos para ti`
        : nada,
  });
}

export async function PATCH(req: NextRequest) {
  const { id, ...cambios } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await actualizarNuevo(id, cambios);
  return NextResponse.json({ ok: true });
}
