import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

/** POST /api/admin/toggle
 *  Body: { type: "npcs"|"lore"|"rulers", id: string }
 *  Flips is_locked on the record. Requires admin session.
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
    const supabase = getAdminClient();
    // Fetch current is_locked
    const { data: existing, error: fetchErr } = await supabase
      .from(table)
      .select("id, is_locked")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: fetchErr?.message || "record not found" },
        { status: 404 }
      );
    }
    const newVal = !existing.is_locked;
    const { data, error } = await supabase
      .from(table)
      .update({ is_locked: newVal })
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
