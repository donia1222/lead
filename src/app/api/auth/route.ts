import { NextRequest, NextResponse } from "next/server";
import { BASE } from "@/lib/almacen";

/**
 * Quien dice si el codigo vale es el servidor de Roberto, no una variable de
 * entorno: asi Vercel no necesita guardar ningun secreto. Se le pregunta al
 * almacen con el codigo; si contesta, el codigo es bueno y se guarda en la
 * cookie para las siguientes llamadas.
 */
export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code) return NextResponse.json({ ok: false, error: "Falta el codigo" }, { status: 400 });

  try {
    const r = await fetch(`${BASE}/lead.php?coleccion=leads`, {
      headers: { "X-Lead-Codigo": String(code) },
      cache: "no-store",
    });
    if (r.status === 401) return NextResponse.json({ ok: false, error: "Falscher Code" }, { status: 401 });
    if (!r.ok) return NextResponse.json({ ok: false, error: `El servidor contesto ${r.status}` }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Sin conexion" }, { status: 502 });
  }

  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set("lead-auth", String(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return respuesta;
}

export async function DELETE() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.delete("lead-auth");
  return respuesta;
}
