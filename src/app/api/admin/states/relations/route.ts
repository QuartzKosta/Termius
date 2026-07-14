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

const str = (v: unknown, max: number): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
  return null;
};

const VALID_TYPES = new Set([
  "alliance",
  "war",
  "pact",
  "rivalry",
  "neutral",
  "vassal",
  "trade",
]);

/** GET /api/admin/states/relations — all relations with both states included. */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const relations = await db.stateRelation.findMany({
      include: {
        stateA: { select: { id: true, name: true, sigil: true, color: true } },
        stateB: { select: { id: true, name: true, sigil: true, color: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      data: relations.map((r) => ({
        id: r.id,
        stateAId: r.stateAId,
        stateBId: r.stateBId,
        stateA: r.stateA,
        stateB: r.stateB,
        relationshipType: r.relationshipType,
        description: r.description,
        treatyDate: r.treatyDate,
      })),
    });
  } catch (e: any) {
    console.error("[admin/states/relations GET] error:", e?.message, e?.stack);
    const msg = e?.message || "internal error";
    const hint = /can't reach database|does not exist|no such table|P2021|P2023|P2024/i.test(msg)
      ? " База данных не инициализирована. Выполните: bun run db:push"
      : "";
    return NextResponse.json(
      { error: msg + hint, data: [] },
      { status: 500 }
    );
  }
}

/** POST /api/admin/states/relations — create OR update a relation.
 *  Body: { id?, stateAId, stateBId, relationshipType, description?, treatyDate? }
 *  Always stores with stateAId < stateBId alphabetically (canonical pair) to
 *  avoid duplicate reverse pairs. If updating and the pair changes, the old
 *  row is deleted.
 */
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const aIn = str(body.stateAId, 64);
    const bIn = str(body.stateBId, 64);
    const type = str(body.relationshipType, 30);

    if (!aIn || !bIn) {
      return NextResponse.json(
        { error: "stateAId and stateBId required" },
        { status: 400 }
      );
    }
    if (aIn === bIn) {
      return NextResponse.json(
        { error: "a state cannot relate to itself" },
        { status: 400 }
      );
    }
    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: "invalid relationshipType" },
        { status: 400 }
      );
    }

    // Canonical ordering: stateAId < stateBId
    const [stateAId, stateBId] = aIn < bIn ? [aIn, bIn] : [bIn, aIn];

    // Verify both states exist
    const [sA, sB] = await Promise.all([
      db.state.findUnique({ where: { id: stateAId }, select: { id: true } }),
      db.state.findUnique({ where: { id: stateBId }, select: { id: true } }),
    ]);
    if (!sA || !sB) {
      return NextResponse.json(
        { error: "one or both states not found" },
        { status: 404 }
      );
    }

    const data = {
      stateAId,
      stateBId,
      relationshipType: type,
      description: str(body.description, 2000),
      treatyDate: str(body.treatyDate, 100),
    };

    const id = str(body.id, 64);
    if (id) {
      // Update path. If the canonical pair changed, we cannot just update the
      // unique pair (could collide); delete old + create new.
      const existing = await db.stateRelation.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json(
          { error: "relation not found" },
          { status: 404 }
        );
      }
      const pairChanged =
        existing.stateAId !== stateAId || existing.stateBId !== stateBId;

      if (pairChanged) {
        // Delete the old row and create a fresh one with the new pair.
        await db.stateRelation.delete({ where: { id } });
        const created = await db.stateRelation.create({ data });
        return NextResponse.json({ ok: true, data: created });
      }
      // Same pair — just update non-key fields.
      const updated = await db.stateRelation.update({
        where: { id },
        data: {
          relationshipType: data.relationshipType,
          description: data.description,
          treatyDate: data.treatyDate,
        },
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    // Create path. Reject duplicates (the @@unique constraint will also
    // enforce this, but we return a friendlier message).
    const dup = await db.stateRelation.findUnique({
      where: { stateAId_stateBId: { stateAId, stateBId } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "relation between these states already exists" },
        { status: 409 }
      );
    }
    const created = await db.stateRelation.create({ data });
    return NextResponse.json({ ok: true, data: created });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "bad request" },
      { status: 400 }
    );
  }
}
