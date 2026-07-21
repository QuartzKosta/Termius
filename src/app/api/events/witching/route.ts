import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/events/witching
 *  Public endpoint — returns ALL witching hour alarms (shared across all users).
 *  Each alarm has its own schedule, boost, title, message.
 *  The console checks if ANY alarm is currently active.
 *
 *  Response: { data: [{ id, name, enabled, startHour, ..., manualOverride }, ...] }
 */
export async function GET() {
  try {
    const configs = await db.eventConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      data: configs.map((c) => ({
        id: c.id,
        name: c.name,
        enabled: c.enabled,
        startHour: c.startHour,
        startMinute: c.startMinute,
        endHour: c.endHour,
        endMinute: c.endMinute,
        timezone: c.timezone,
        boost: c.boost,
        title: c.title,
        msg: c.msg,
        manualOverride: c.manualOverride,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (e: any) {
    console.error("[events/witching GET] error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "internal error", data: [] },
      { status: 500 }
    );
  }
}
