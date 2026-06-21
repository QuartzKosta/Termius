import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN = "ashen-warden-" + ((process.env.ADMIN_PASSWORD || "WARDEN").length * 7) + "-granted";

function isAuthenticated(): boolean {
  // cookies() is async in Next.js 15+, but we can read synchronously here via the awaited value.
  // This helper is called within the async handler.
  return true; // actual check done in handler
}

async function checkAuth(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value === SESSION_TOKEN;
}

/** GET /api/admin/list?type=npcs|lore|rulers|all
 *  Returns records from one or all tables. Requires admin session.
 */
export async function GET(req: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "all";
  const supabase = getAdminClient();

  try {
    if (type === "all") {
      const [npcs, lore, rulers] = await Promise.all([
        supabase.from("npcs").select("*").order("created_at", { ascending: true }),
        supabase.from("lore").select("*").order("created_at", { ascending: true }),
        supabase.from("rulers").select("*").order("created_at", { ascending: true }),
      ]);
      return NextResponse.json({
        data: {
          npcs: npcs.data || [],
          lore: lore.data || [],
          rulers: rulers.data || [],
        },
        errors: { npcs: npcs.error?.message, lore: lore.error?.message, rulers: rulers.error?.message },
      });
    }
    const table = TABLE_MAP[type];
    if (!table) {
      return NextResponse.json({ error: `invalid type "${type}"` }, { status: 400 });
    }
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      return NextResponse.json({ error: error.message, data: [] }, { status: 200 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
