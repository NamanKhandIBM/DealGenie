import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = process.env.APP_PASSWORD;

  if (!password) {
    // If env var not set, deny access to avoid accidental open access
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (body.password !== password) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Set a session cookie valid for 7 days
  const res = NextResponse.json({ ok: true });
  res.cookies.set("dg_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
