import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

/** POST /api/admin/prophecy
 *  Body: { type, id } — назначить запись пророчеством дня
 *  Body: { type: "clear", id: "all" } — снять все пророчества
 *  Требует админскую сессию.
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type, id, action } = body;
    const supabase = getAdminClient();

    if (action === "clear") {
      // Снять все пророчества во всех таблицах
      await Promise.all([
        supabase.from("npcs").update({ prophecy_date: null }).neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("lore").update({ prophecy_date: null }).neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("rulers").update({ prophecy_date: null }).neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);
      return NextResponse.json({ ok: true, cleared: true });
    }

    const table = TABLE_MAP[type];
    if (!table || !id) {
      return NextResponse.json({ error: "type and id required" }, { status: 400 });
    }

    // Снять пророчества с других записей в этой таблице
    await supabase.from(table).update({ prophecy_date: null }).neq("id", id);

    // Назначить эту запись пророчеством дня
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from(table)
      .update({ prophecy_date: today })
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
