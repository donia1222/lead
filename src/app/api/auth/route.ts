import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const accessCode = process.env.ACCESS_CODE;

  if (!accessCode) {
    return NextResponse.json({ ok: true });
  }

  if (code === accessCode) {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("lead-auth", accessCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ ok: false, error: "Falscher Code" }, { status: 401 });
}
