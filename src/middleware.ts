import { NextRequest, NextResponse } from "next/server";

/**
 * Aqui ya no se compara con ninguna variable de entorno: quien valida el codigo
 * es el servidor de Roberto (lead.php). Esto solo mira que haya sesion; si la
 * cookie lleva un codigo malo, el PHP contestara 401 y se vuelve a entrar.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/auth")) return NextResponse.next();

  const sesion = req.cookies.get("lead-auth")?.value;
  if (sesion) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
