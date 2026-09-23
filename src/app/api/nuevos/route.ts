import { NextRequest, NextResponse } from "next/server";
import { buscarAltas } from "@/lib/shab";
import { buscarWeb } from "@/lib/search";
import { actualizarNuevo, fusionar, getNuevos } from "@/lib/nuevos-store";

export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ nuevos: await getNuevos() });
}

/** Refrescar: traer altas del boletin y mirar a cuales no se les ve web. */
export async function POST(req: NextRequest) {
  const { dias, minutos, cantones } = await req.json().catch(() => ({}));

  const altas = await buscarAltas({
    dias: Number(dias) || 14,
    minutos: Number(minutos) || 15,
    cantones: Array.isArray(cantones) && cantones.length ? cantones : ["SG"],
  });

  const recien = await fusionar(altas);
  console.log(`[NUEVOS] ${altas.length} cerca, ${recien.length} que no tenias`);

  // Solo se busca web de los recien llegados: los de antes ya se miraron.
  for (const n of recien) {
    const { web, email, telefono } = await buscarWeb(n.nombre, n.localidad);
    await actualizarNuevo(n.id, { web, email, telefono, webComprobada: true });
    await new Promise((r) => setTimeout(r, 800));
  }

  return NextResponse.json({
    nuevos: await getNuevos(),
    recien: recien.length,
    mensaje: `${altas.length} altas cerca · ${recien.length} nuevas para ti`,
  });
}

export async function PATCH(req: NextRequest) {
  const { id, ...cambios } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await actualizarNuevo(id, cambios);
  return NextResponse.json({ ok: true });
}
