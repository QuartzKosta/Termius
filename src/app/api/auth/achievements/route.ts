import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthClient } from "@/lib/auth";

export const dynamic = "force-dynamic";
const PLAYER_COOKIE = "ashen_player_session";

/** GET /api/auth/achievements — list achievement IDs unlocked by the current player. */
export async function GET() {
  const c = await cookies();
  const playerId = c.get(PLAYER_COOKIE)?.value;
  if (!playerId)
    return NextResponse.json({ ok: false, error: "not logged in" }, { status: 401 });
  const supabase = getAuthClient();
  const { data, error } = await supabase
    .from("player_achievements")
    .select("achievement_id")
    .eq("player_id", playerId);
  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    achievements: (data || []).map((a: any) => a.achievement_id),
  });
}

/** POST /api/auth/achievements — unlock an achievement for the current player.
 *  Body: { achievement_id: string }
 *  Uses upsert so re-unlocking is idempotent (UNIQUE constraint on player_id+achievement_id).
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  const playerId = c.get(PLAYER_COOKIE)?.value;
  if (!playerId)
    return NextResponse.json({ ok: false, error: "not logged in" }, { status: 401 });
  try {
    const body = await req.json();
    const { achievement_id } = body;
    if (!achievement_id)
      return NextResponse.json({ error: "achievement_id required" }, { status: 400 });
    const supabase = getAuthClient();
    const { error } = await supabase
      .from("player_achievements")
      .upsert(
        { player_id: playerId, achievement_id },
        { onConflict: "player_id,achievement_id" }
      );
    if (error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
