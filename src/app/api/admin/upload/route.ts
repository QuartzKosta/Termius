import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";
const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { type, name, category, title, description, image_url, sigil, puzzle_type, puzzle_hint, puzzle_data, shard_word, prophecy_bonus_text, map_x, map_y, custom_trigger, is_locked } = body;
    const table = TABLE_MAP[type];
    if (!table) return NextResponse.json({ error: "invalid type" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const payload: Record<string, unknown> = {
      name: String(name).trim().slice(0,200),
      category: String(category||"БЕЗ КАТЕГОРИИ").trim().slice(0,100),
      title: title?.trim() || null,
      description: description?.trim() || null,
      image_url: image_url?.trim() || null,
      sigil: sigil || "i-skull",
      is_locked: !!is_locked,
    };
    if (puzzle_type && puzzle_type !== "none") { payload.puzzle_type = puzzle_type; payload.puzzle_hint = puzzle_hint?.trim()||null; payload.puzzle_data = puzzle_data?.trim()||null; }
    if (shard_word?.trim()) payload.shard_word = shard_word.trim().toUpperCase();
    if (prophecy_bonus_text?.trim()) payload.prophecy_bonus_text = prophecy_bonus_text.trim();
    if (typeof map_x === "number") payload.map_x = map_x;
    if (typeof map_y === "number") payload.map_y = map_y;
    if (custom_trigger?.trim()) payload.custom_trigger = custom_trigger.trim();
    const supabase = getAdminClient();
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
