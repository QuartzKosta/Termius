import { NextResponse } from "next/server";
import { db, assertStateModelsReady } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/states/relations — public listing of relations where BOTH
 *  endpoint states are non-locked. */
export async function GET() {
  try {
    assertStateModelsReady();
    const relations = await db.stateRelation.findMany({
      include: {
        stateA: { select: { id: true, name: true, sigil: true, color: true, isLocked: true } },
        stateB: { select: { id: true, name: true, sigil: true, color: true, isLocked: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Filter out relations where either endpoint is locked OR missing.
    const visible = relations.filter(
      (r) => r.stateA && r.stateB && !r.stateA.isLocked && !r.stateB.isLocked
    );

    return NextResponse.json({
      data: visible.map((r) => ({
        id: r.id,
        stateAId: r.stateAId,
        stateBId: r.stateBId,
        // Public shape — no isLocked leaked.
        stateA: { id: r.stateA.id, name: r.stateA.name, sigil: r.stateA.sigil, color: r.stateA.color },
        stateB: { id: r.stateB.id, name: r.stateB.name, sigil: r.stateB.sigil, color: r.stateB.color },
        relationshipType: r.relationshipType,
        description: r.description,
        treatyDate: r.treatyDate,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error", data: [] },
      { status: 500 }
    );
  }
}
