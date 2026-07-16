import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "ashen_admin_session";
const SESSION_TOKEN =
  "ashen-warden-" + (process.env.ADMIN_PASSWORD || "WARDEN").length * 7 + "-granted";

async function checkAuth(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value === SESSION_TOKEN;
}

const num = (v: unknown, fallback: number): number => {
  if (typeof v === "number" && !isNaN(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Math.floor(Number(v));
  return fallback;
};

const str = (v: unknown, max: number, fallback: string): string => {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
  return fallback;
};

/** POST /api/admin/events/witching
 *  Body: { enabled?, startHour?, startMinute?, endHour?, endMinute?,
 *          timezone?, boost?, title?, msg?, manualOverride? }
 *  Updates the singleton Witching Hour config. All fields optional — only
 *  provided fields are updated. Returns the full updated config.
 */
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    // Ensure the config row exists
    let cfg = await db.eventConfig.findUnique({ where: { id: "witching_hour" } });
    if (!cfg) {
      cfg = await db.eventConfig.create({ data: { id: "witching_hour" } });
    }

    // Build update object from provided fields
    const update: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    if (body.startHour !== undefined) update.startHour = Math.max(0, Math.min(23, num(body.startHour, 3)));
    if (body.startMinute !== undefined) update.startMinute = Math.max(0, Math.min(59, num(body.startMinute, 0)));
    if (body.endHour !== undefined) update.endHour = Math.max(0, Math.min(23, num(body.endHour, 4)));
    if (body.endMinute !== undefined) update.endMinute = Math.max(0, Math.min(59, num(body.endMinute, 0)));
    if (body.timezone !== undefined) update.timezone = Math.max(-12, Math.min(14, num(body.timezone, 3)));
    if (body.boost !== undefined) update.boost = Math.max(0, Math.min(100, num(body.boost, 15)));
    if (body.title !== undefined) update.title = str(body.title, 100, "ЧАС ВЕДЬМЫ");
    if (body.msg !== undefined) update.msg = str(body.msg, 500, "бог смотрит пристальнее");
    if (body.manualOverride !== undefined) {
      // null | "on" | "off"
      if (body.manualOverride === null) update.manualOverride = null;
      else if (body.manualOverride === "on" || body.manualOverride === "off") {
        update.manualOverride = body.manualOverride;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, data: cfg, note: "no fields to update" });
    }

    const updated = await db.eventConfig.update({
      where: { id: "witching_hour" },
      data: update,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    console.error("[admin/events/witching POST] error:", e?.message, e?.stack);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/** GET /api/admin/events/witching — same as public but includes manualOverride (already public). */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    let cfg = await db.eventConfig.findUnique({ where: { id: "witching_hour" } });
    if (!cfg) {
      cfg = await db.eventConfig.create({ data: { id: "witching_hour" } });
    }
    return NextResponse.json({ data: cfg });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
