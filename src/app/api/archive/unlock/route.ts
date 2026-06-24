import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id } = body;
    const table = TABLE_MAP[type];
    if (!table || !id) return NextResponse.json({ error: "type and id required" }, { status: 400 });
    const supabase = getAdminClient();
    const { data: existing, error: fetchErr } = await supabase.from(table).select("id, is_locked").eq("id", id).single();
    if (fetchErr || !existing) return NextResponse.json({ error: "record not found" }, { status: 404 });
    if (!existing.is_locked) return NextResponse.json({ ok: true, already_unlocked: true });
    const { error } = await supabase.from(table).update({ is_locked: false }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
