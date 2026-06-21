import { NextRequest, NextResponse } from "next/server";
import { getPublicClient, TABLE_MAP } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/archive?type=npcs|lore|rulers
 *  Public endpoint — returns all records from the requested table.
 *  Locked records are included (so the UI can render them as corrupted).
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "npcs";
  const table = TABLE_MAP[type];
  if (!table) {
    return NextResponse.json(
      { error: `Invalid type "${type}". Expected npcs|lore|rulers.` },
      { status: 400 }
    );
  }
  try {
    const supabase = getPublicClient();
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[archive] supabase error:", error.message);
      return NextResponse.json(
        { error: error.message, data: [] },
        { status: 200 }
      );
    }
    return NextResponse.json({ data: data || [] });
  } catch (e: any) {
    console.error("[archive] exception:", e?.message);
    return NextResponse.json(
      { error: e?.message || "internal error", data: [] },
      { status: 200 }
    );
  }
}
