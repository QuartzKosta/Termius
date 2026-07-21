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

/** GET /api/admin/events/witching — returns ALL alarms (for admin panel). */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const configs = await db.eventConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: configs });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/** POST /api/admin/events/witching — create OR update an alarm.
 *  Body: { id?, name?, enabled?, startHour?, ..., manualOverride? }
 *  If `id` present → update existing alarm.
 *  If no `id` → create new alarm.
 *  Returns { ok: true, data: alarm }
 */
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = str(body.name, 100, "Час Ведьмы");
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
      if (body.manualOverride === null) update.manualOverride = null;
      else if (body.manualOverride === "on" || body.manualOverride === "off") {
        update.manualOverride = body.manualOverride;
      }
    }

    // If id provided → update
    if (typeof body.id === "string" && body.id.trim()) {
      const updated = await db.eventConfig.update({
        where: { id: body.id },
        data: update,
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    // No id → create new alarm
    const created = await db.eventConfig.create({
      data: {
        name: str(body.name, 100, "Новый будильник"),
        enabled: typeof body.enabled === "boolean" ? body.enabled : false,
        startHour: num(body.startHour, 3),
        startMinute: num(body.startMinute, 0),
        endHour: num(body.endHour, 4),
        endMinute: num(body.endMinute, 0),
        timezone: num(body.timezone, 3),
        boost: num(body.boost, 15),
        title: str(body.title, 100, "ЧАС ВЕДЬМЫ"),
        msg: str(body.msg, 500, "бог смотрит пристальнее"),
        manualOverride: body.manualOverride === "on" || body.manualOverride === "off" ? body.manualOverride : null,
      },
    });
    return NextResponse.json({ ok: true, data: created });
  } catch (e: any) {
    console.error("[admin/events/witching POST] error:", e?.message, e?.stack);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/admin/events/witching — delete an alarm.
 *  Body: { id }
 */
export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = str(body.id, 64, "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await db.eventConfig.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
