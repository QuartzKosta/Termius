import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, TABLE_MAP, ArchiveTable } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** POST /api/archive/unlock
 *  Body: { type: "npcs"|"lore"|"rulers", id: string }
 *  Sets is_locked = false on the record. Uses admin client (service_role)
 *  because anon key is read-only.
 *  Returns { ok: true } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id } = body;
    if (!type || !id)
      return NextResponse.json({ error: "type and id required" }, { status: 400 });

    const table = TABLE_MAP[type];
    if (!table)
      return NextResponse.json(
        { error: `Invalid type "${type}". Expected npcs|lore|rulers.` },
        { status: 400 }
      );

    const supabase = getAdminClient();
    const { error } = await supabase
      .from(table as ArchiveTable)
      .update({ is_locked: false })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "bad request" }, { status: 400 });
  }
}
