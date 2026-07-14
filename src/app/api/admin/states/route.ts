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

/** GET /api/admin/states — all states (including locked). */
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const states = await db.state.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: states });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "internal error", data: [] },
      { status: 500 }
    );
  }
}

/** POST /api/admin/states — create OR update a state.
 *  Body: { id?, name, sigil?, color?, description?, category?, isLocked? }
 *  If `id` is present → update, else → create.
 */
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = str(body.name, 200);
    if (!name) {
      return NextResponse.json(
        { error: "name required" },
        { status: 400 }
      );
    }
    const data = {
      name,
      sigil: str(body.sigil, 50),
      color: str(body.color, 20),
      description: str(body.description, 5000),
      category: str(body.category, 100),
      isLocked: !!body.isLocked,
    };

    const id = str(body.id, 64);
    if (id) {
      // Update existing
      const updated = await db.state.update({
        where: { id },
        data,
      });
      return NextResponse.json({ ok: true, data: updated });
    }
    const created = await db.state.create({ data });
    return NextResponse.json({ ok: true, data: created });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "bad request" },
      { status: 400 }
    );
  }
}
