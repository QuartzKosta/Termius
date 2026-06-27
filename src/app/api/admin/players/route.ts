import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthClient, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN =
  "ashen-warden-" + (process.env.ADMIN_PASSWORD || "WARDEN").length * 7 + "-granted";

/** GET /api/admin/players — list all wardens with their achievements.
 *  Requires admin session cookie.
 */
export async function GET() {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getAuthClient();
  const { data: players, error } = await supabase
    .from("players")
    .select("id, warden_name, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: ach } = await supabase
    .from("player_achievements")
    .select("player_id, achievement_id");
  const achMap: Record<string, string[]> = {};
  (ach || []).forEach((a: any) => {
    if (!achMap[a.player_id]) achMap[a.player_id] = [];
    achMap[a.player_id].push(a.achievement_id);
  });

  return NextResponse.json({
    data: (players || []).map((p: any) => ({ ...p, achievements: achMap[p.id] || [] })),
  });
}

/** POST /api/admin/players — create warden, reset password, reset achievements, or delete.
 *  Body variants:
 *    { warden_name, password }                          — create
 *    { action: "reset_password", id, new_password }     — reset password
 *    { action: "reset_achievements", id }               — clear achievements
 *    { action: "delete", id }                           — delete warden
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const supabase = getAuthClient();

    if (body.action === "reset_password") {
      const { error } = await supabase
        .from("players")
        .update({ password_hash: hashPassword(body.new_password) })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_achievements") {
      const { error } = await supabase
        .from("player_achievements")
        .delete()
        .eq("player_id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_fragments") {
      // Delete only FRAG_ prefixed achievements (re-seal hidden fragments)
      const { error } = await supabase
        .from("player_achievements")
        .delete()
        .eq("player_id", body.id)
        .like("achievement_id", "FRAG_%");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete") {
      const { error } = await supabase.from("players").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // Create
    if (!body.warden_name || !body.password)
      return NextResponse.json(
        { error: "warden_name and password required" },
        { status: 400 }
      );
    const { data, error } = await supabase
      .from("players")
      .insert({
        warden_name: body.warden_name.trim().slice(0, 50),
        password_hash: hashPassword(body.password),
      })
      .select("id, warden_name, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
