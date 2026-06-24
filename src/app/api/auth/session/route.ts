import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthClient } from "@/lib/auth";

export const dynamic = "force-dynamic";
const PLAYER_COOKIE = "ashen_player_session";

export async function GET() {
  const c = await cookies();
  const playerId = c.get(PLAYER_COOKIE)?.value;
  if (!playerId) return NextResponse.json({ ok: false }, { status: 401 });
  const supabase = getAuthClient();
  const { data: player, error } = await supabase.from("players").select("id, warden_name").eq("id", playerId).single();
  if (error || !player) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, player });
}
