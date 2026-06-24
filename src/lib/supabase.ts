import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || "";

/** Public client using anon key — read-only access to public data. */
export function getPublicClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** Admin client using service role key — bypasses RLS. Server-side ONLY. */
export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export type ArchiveTable = "npcs" | "lore" | "rulers";

export interface ArchiveRecord {
  id: string;
  name: string;
  category: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  sigil: string | null;
  is_locked: boolean;
  puzzle_type: string | null;
  puzzle_data: string | null;
  puzzle_hint: string | null;
  created_at: string | null;
}

export const TABLE_MAP: Record<string, ArchiveTable> = {
  npcs: "npcs",
  lore: "lore",
  rulers: "rulers",
};
