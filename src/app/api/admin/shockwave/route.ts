import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

/** POST /api/admin/shockwave
 *  Body: { amount: number } — ударная волна коррупции
 *  Записывает значение в localStorage-independent store (через cookie),
 *  чтобы консоль могла прочитать.
 *  Требует админскую сессию.
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const amount = Math.max(1, Math.min(100, parseInt(body.amount) || 15));
    // Устанавливаем cookie с ударной волной — консоль прочитает при следующем тике
    const res = NextResponse.json({ ok: true, amount });
    res.cookies.set("ashen_shockwave", String(amount), {
      httpOnly: false, // клиент должен прочитать
      sameSite: "strict",
      path: "/",
      maxAge: 60, // 1 минута — достаточно для прочтения
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}

/** GET /api/admin/shockwave — консоль опрашивает наличие ударной волны */
export async function GET() {
  // Этот endpoint публичный (консоль читает), но cookie установлен только админом
  const c = await cookies();
  const sw = c.get("ashen_shockwave")?.value;
  if (sw) {
    const res = NextResponse.json({ amount: parseInt(sw) || 0 });
    // Удаляем cookie после прочтения
    res.cookies.delete("ashen_shockwave");
    return res;
  }
  return NextResponse.json({ amount: 0 });
}
