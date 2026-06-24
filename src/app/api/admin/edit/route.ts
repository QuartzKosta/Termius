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
    const { type, id } = body;
    const table = TABLE_MAP[type];
    if (!table || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    const fields = ["name","category","title","description","image_url","sigil","puzzle_type","puzzle_hint","puzzle_data","shard_word","prophecy_bonus_text","custom_trigger"];
    fields.forEach(f => { if (typeof body[f] === "string") { if(f==="shard_word"&&body[f].trim()) patch[f]=body[f].trim().toUpperCase(); else if(f==="puzzle_type"&&body[f]==="none") patch[f]=null; else patch[f]=body[f].trim()||null; } });
    if (typeof body.map_x === "number") patch.map_x = body.map_x;
    if (typeof body.map_y === "number") patch.map_y = body.map_y;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no fields" }, { status: 400 });
    const supabase = getAdminClient();
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
