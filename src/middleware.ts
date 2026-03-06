import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;

  // No protection if no code is set
  if (!accessCode) return NextResponse.next();

  // Allow auth API
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check cookie
  const cookie = req.cookies.get("lead-auth");
  if (cookie?.value === accessCode) {
    return NextResponse.next();
  }

  // For API routes, return 401
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // For pages, redirect to login
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
