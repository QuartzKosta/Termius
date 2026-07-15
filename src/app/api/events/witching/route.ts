import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/events/witching
 *  Public endpoint — returns the Witching Hour config (shared across all users).
 *  This replaces the old localStorage-only approach which caused Witching Hour
 *  to work for the admin (who configured it) but NOT for other users (who had
 *  the default `enabled: false` config in their own localStorage).
 *
 *  Response: { data: { enabled, startHour, startMinute, endHour, endMinute,
 *                      timezone, boost, title, msg, manualOverride, updatedAt } }
 */
export async function GET() {
  try {
    let cfg = await db.eventConfig.findUnique({ where: { id: "witching_hour" } });
    if (!cfg) {
      // Create default config row on first access
      cfg = await db.eventConfig.create({
        data: { id: "witching_hour" },
      });
    }
    return NextResponse.json({
      data: {
        enabled: cfg.enabled,
        startHour: cfg.startHour,
        startMinute: cfg.startMinute,
        endHour: cfg.endHour,
        endMinute: cfg.endMinute,
        timezone: cfg.timezone,
        boost: cfg.boost,
        title: cfg.title,
        msg: cfg.msg,
        manualOverride: cfg.manualOverride, // null | "on" | "off"
        updatedAt: cfg.updatedAt,
      },
    });
  } catch (e: any) {
    console.error("[events/witching GET] error:", e?.message);
    return NextResponse.json(
      { error: e?.message || "internal error", data: null },
      { status: 500 }
    );
  }
}
