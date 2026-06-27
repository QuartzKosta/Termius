import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN =
  "ashen-warden-" + (process.env.ADMIN_PASSWORD || "WARDEN").length * 7 + "-granted";

/** POST /api/admin/upload
 *  Body: { type, name, category, title, description, image_url, sigil,
 *          is_locked, puzzle_type, puzzle_data, puzzle_hint, shard_word,
 *          prophecy_bonus_text, prophecy_date, map_x, map_y, custom_trigger }
 *  Creates a new record. Requires admin session.
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type } = body;
    const table = TABLE_MAP[type];
    if (!table) {
      return NextResponse.json({ error: `invalid type "${type}"` }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    // Build payload with all supported fields (null if absent/empty)
    const str = (v: unknown, max: number) => {
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
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
    const payload: Record<string, unknown> = {
      name: String(body.name).trim().slice(0, 200),
      category: String(body.category || "UNCATEGORIZED").trim().slice(0, 100),
      title: str(body.title, 300),
      description: str(body.description, 10000),
      image_url: str(body.image_url, 1000),
      sigil: str(body.sigil, 50),
      is_locked: !!body.is_locked,
      puzzle_type: str(body.puzzle_type, 50),
      puzzle_data: str(body.puzzle_data, 10000),
      puzzle_hint: str(body.puzzle_hint, 1000),
      shard_word: str(body.shard_word, 100),
      prophecy_bonus_text: str(body.prophecy_bonus_text, 2000),
      prophecy_date: str(body.prophecy_date, 20),
      map_x: numOrNull(body.map_x),
      map_y: numOrNull(body.map_y),
      custom_trigger: str(body.custom_trigger, 2000),
    };
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
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
