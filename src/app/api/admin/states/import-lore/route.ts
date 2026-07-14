import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getPublicClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN =
  "ashen-warden-" + (process.env.ADMIN_PASSWORD || "WARDEN").length * 7 + "-granted";

async function checkAuth(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value === SESSION_TOKEN;
}

/** Suggested color + emoji per state title (category).
 *  Falls back to green + ● for unknown titles. */
const TITLE_META: Record<string, { emoji: string; color: string; category: string }> = {
  "Империя":     { emoji: "🌹", color: "#ff2424", category: "ИМПЕРИЯ" },
  "Королевство": { emoji: "👑", color: "#4af626", category: "КОРОЛЕВСТВО" },
  "Княжество":   { emoji: "🔨", color: "#e8a13a", category: "КНЯЖЕСТВО" },
  "Теократия":   { emoji: "✨", color: "#fbbf24", category: "ТЕОКРАТИЯ" },
  "Республика":  { emoji: "⚖️", color: "#3fd6c8", category: "РЕСПУБЛИКА" },
  "Орда":        { emoji: "💀", color: "#a78bfa", category: "ОРДА" },
  "Коловод":     { emoji: "🌙", color: "#c4b5fd", category: "КОЛОВОД" },
  "Братство":    { emoji: "🜂", color: "#fbbf24", category: "БРАТСТВО" },
};

const DEFAULT_META = { emoji: "●", color: "#4af626", category: "ГОСУДАРСТВО" };

interface LoreRecord {
  id: string;
  name: string;
  category: string | null;
  title: string | null;
  description: string | null;
  sigil: string | null;
  is_locked: boolean;
}

/** POST /api/admin/states/import-lore
 *  Pulls lore records whose category === "Государство" from Supabase
 *  and upserts them into the State table (matched by name).
 *  - New lore states → created in State table.
 *  - Existing states (by name) → description/category/sigil updated.
 *  - States in State table that no longer exist in lore → left untouched
 *    (admin can delete them manually).
 *  Relations are NOT touched by this import.
 *  Returns { ok, imported: N, created: N, updated: N, states: [...] }
 */
export async function POST() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch lore records from Supabase
    const supabase = getPublicClient();
    const { data: loreData, error } = await supabase
      .from("lore")
      .select("id, name, category, title, description, sigil, is_locked")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Supabase error: " + error.message },
        { status: 500 }
      );
    }

    // 2. Filter only "Государство" records (case-insensitive match on category)
    const loreStates = (loreData || []).filter(
      (r: LoreRecord) =>
        r.category && r.category.toLowerCase().includes("государств")
    );

    // 3. Get existing states (to match by name)
    const existing = await db.state.findMany();
    const existingByName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));

    let created = 0;
    let updated = 0;
    const results: { name: string; action: "created" | "updated"; id: string }[] = [];

    // 4. Upsert each lore state
    for (const lore of loreStates as LoreRecord[]) {
      const meta = (lore.title && TITLE_META[lore.title]) || DEFAULT_META;
      // Truncate description to 500 chars (full text lives in the lore panel)
      const desc = (lore.description || "").slice(0, 500) +
        ((lore.description || "").length > 500 ? "…" : "");
      const existingState = existingByName.get(lore.name.toLowerCase());

      if (existingState) {
        // Update — only refresh description/category/sigil if they differ
        await db.state.update({
          where: { id: existingState.id },
          data: {
            description: desc,
            category: meta.category,
            // Keep existing color + sigil if admin already customized them,
            // only set defaults if they were null/empty.
            color: existingState.color || meta.color,
            sigil: existingState.sigil || meta.emoji,
          },
        });
        updated++;
        results.push({ name: lore.name, action: "updated", id: existingState.id });
      } else {
        // Create
        const newState = await db.state.create({
          data: {
            name: lore.name,
            sigil: meta.emoji,
            color: meta.color,
            category: meta.category,
            description: desc,
            isLocked: false,
          },
        });
        created++;
        results.push({ name: lore.name, action: "created", id: newState.id });
      }
    }

    return NextResponse.json({
      ok: true,
      imported: loreStates.length,
      created,
      updated,
      states: results,
    });
  } catch (e: any) {
    console.error("[import-lore] error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
