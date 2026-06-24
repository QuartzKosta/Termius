import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthClient, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
const PLAYER_COOKIE = "ashen_player_session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { warden_name, password } = body;
    if (!warden_name || !password)
      return NextResponse.json({ error: "Имя и пароль обязательны" }, { status: 400 });
    const supabase = getAuthClient();
    const { data: player, error } = await supabase
      .from("players").select("id, warden_name, password_hash").eq("warden_name", warden_name).single();
    if (error || !player)
      return NextResponse.json({ error: "Страж не найден" }, { status: 404 });
    if (!verifyPassword(password, player.password_hash))
      return NextResponse.json({ error: "Неверный шифр" }, { status: 401 });
    const res = NextResponse.json({ ok: true, player: { id: player.id, warden_name: player.warden_name } });
    res.cookies.set(PLAYER_COOKIE, player.id, { httpOnly: true, sameSite: "strict", path: "/", maxAge: 60*60*24*7 });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}

export async function GET() {
  const c = await cookies();
  const playerId = c.get(PLAYER_COOKIE)?.value;
  if (!playerId) return NextResponse.json({ ok: false }, { status: 401 });
  const supabase = getAuthClient();
  const { data: player, error } = await supabase.from("players").select("id, warden_name").eq("id", playerId).single();
  if (error || !player) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, player });
}
