import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

/** POST /api/admin/upload
 *  Body: { type, name, category, title, description, image_url, sigil }
 *  Creates a new record in the specified table. Requires admin session.
 */
export async function POST(req: NextRequest) {
  const c = await cookies();
  if (c.get(COOKIE_NAME)?.value !== SESSION_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { type, name, category, title, description, image_url, sigil } = body;
    const table = TABLE_MAP[type];
    if (!table) {
      return NextResponse.json({ error: `invalid type "${type}"` }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const payload = {
      name: String(name).trim().slice(0, 200),
      category: String(category || "UNCATEGORIZED").trim().slice(0, 100),
      title: title ? String(title).trim().slice(0, 300) : null,
      description: description ? String(description).trim() : null,
      image_url: image_url ? String(image_url).trim().slice(0, 1000) : null,
      sigil: sigil ? String(sigil).trim().slice(0, 50) : null,
      is_locked: false,
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
