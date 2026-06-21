import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "WARDEN";
const COOKIE_NAME = "ashen_admin_session";
// A simple session token — not cryptographically fancy, but sufficient for a lore admin panel.
const SESSION_TOKEN = "ashen-warden-" + (ADMIN_PASSWORD.length * 7) + "-granted";

/** POST /api/admin/login
 *  Body: { password: string }
 *  On success, sets an HTTP-only cookie and returns { ok: true }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body?.password;
    if (typeof password !== "string" || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "ACCESS DENIED — invalid wardensigil." },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, SESSION_TOKEN, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "bad request" },
      { status: 400 }
    );
  }
}

/** GET /api/admin/login — check if already authenticated. */
export async function GET() {
  const c = await cookies();
  const session = c.get(COOKIE_NAME)?.value;
  if (session === SESSION_TOKEN) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

/** POST /api/admin/logout — clear the session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
