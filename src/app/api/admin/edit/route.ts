import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN =
  "ashen-warden-" + (process.env.ADMIN_PASSWORD || "WARDEN").length * 7 + "-granted";

/** POST /api/admin/edit
 *  Body: { type, id, ...fields } — updates a record.
 *  Accepts the same fields as /upload (name, category, title, description,
 *  image_url, sigil, is_locked, puzzle_type, puzzle_data, puzzle_hint,
 *  shard_word, prophecy_bonus_text, prophecy_date, map_x, map_y, custom_trigger).
 *  Only non-null fields are written. Requires admin session.
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type, id } = body;
    const table = TABLE_MAP[type];
    if (!table || !id) {
      return NextResponse.json({ error: "type and id required" }, { status: 400 });
    }
    const str = (v: unknown, max: number) => {
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
      // If v is an object/array (e.g. admin sent parsed JSON), stringify it
      if (typeof v === "object" && v !== null) {
        try { return JSON.stringify(v).slice(0, max); } catch { return null; }
      }
      return null;
    };
    const numOrNull = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    // Build update payload only from present fields
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = String(body.name).trim().slice(0, 200);
    if (body.category !== undefined) update.category = String(body.category || "UNCATEGORIZED").trim().slice(0, 100);
    if (body.title !== undefined) update.title = str(body.title, 300);
    if (body.description !== undefined) update.description = str(body.description, 10000);
    if (body.image_url !== undefined) update.image_url = str(body.image_url, 1000);
    if (body.sigil !== undefined) update.sigil = str(body.sigil, 50);
    if (body.is_locked !== undefined) update.is_locked = !!body.is_locked;
    if (body.puzzle_type !== undefined) update.puzzle_type = str(body.puzzle_type, 50);
    if (body.puzzle_data !== undefined) update.puzzle_data = str(body.puzzle_data, 10000);
    if (body.puzzle_hint !== undefined) update.puzzle_hint = str(body.puzzle_hint, 1000);
    if (body.shard_word !== undefined) update.shard_word = str(body.shard_word, 100);
    if (body.prophecy_bonus_text !== undefined) update.prophecy_bonus_text = str(body.prophecy_bonus_text, 2000);
    if (body.prophecy_date !== undefined) update.prophecy_date = str(body.prophecy_date, 20);
    if (body.map_x !== undefined) update.map_x = numOrNull(body.map_x);
    if (body.map_y !== undefined) update.map_y = numOrNull(body.map_y);
    if (body.custom_trigger !== undefined) update.custom_trigger = str(body.custom_trigger, 2000);

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from(table)
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
