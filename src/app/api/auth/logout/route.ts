import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const PLAYER_COOKIE = "ashen_player_session";

/** DELETE /api/auth/logout — clears the player session cookie. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PLAYER_COOKIE);
  return res;
}
