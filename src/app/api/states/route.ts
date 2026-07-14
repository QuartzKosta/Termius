import { NextResponse } from "next/server";
import { db, assertStateModelsReady } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/states — public listing of all NON-locked states. */
export async function GET() {
  try {
    assertStateModelsReady();
    const states = await db.state.findMany({
      where: { isLocked: false },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: states });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error", data: [] },
      { status: 500 }
    );
  }
}
