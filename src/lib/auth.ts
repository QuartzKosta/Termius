import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || "";

/** Client for auth operations — uses service_role key (server-side ONLY). */
export function getAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/** Simple SHA-256 hash. */
export function hashPassword(password: string): string {
  return createHash("sha256").update(password + "|ashen_codex_salt").digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
