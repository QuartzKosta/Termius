import { PrismaClient } from '@prisma/client'
import path from 'path'

// ─── Ensure DATABASE_URL is available before PrismaClient is constructed ───
// Next.js loads .env automatically in most cases, but some runtimes (custom
// servers, `bun .next/standalone/server.js`, Docker) do NOT. PrismaClient
// throws "Environment variable not found: DATABASE_URL" in that case.
// Fix: explicitly load .env via dotenv if DATABASE_URL is missing.
if (!process.env.DATABASE_URL) {
  try {
    // dotenv is a transitive dep of @prisma/client; if not installed, skip silently.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv');
    // Try .env in cwd, then .env.local (Next.js convention)
    dotenv.config({ path: '.env' });
    dotenv.config({ path: '.env.local' });
  } catch {
    // dotenv not available — will fall back to default below
  }
}

// Fallback: if DATABASE_URL is STILL not set (e.g. .env file doesn't exist),
// use a sensible default so the app doesn't crash. The DB file will be
// created by `bun run db:push` at this path.
if (!process.env.DATABASE_URL) {
  // Use absolute path to project root to avoid "database not found" issues
  // when the process cwd differs (e.g. standalone server build).
  const dbPath = path.resolve(process.cwd(), 'db', 'custom.db');
  process.env.DATABASE_URL = `file:${dbPath}`;
  console.warn(
    `[db] DATABASE_URL not set in .env — using default: ${process.env.DATABASE_URL}\n` +
    `Create a .env file with DATABASE_URL=file:/path/to/db/custom.db for proper config.`
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/** Verify that the Prisma client knows about the State models.
 *  If not, the generated client is stale (schema.prisma changed but
 *  `prisma generate` was not run). Throws a helpful error. */
export function assertStateModelsReady(): void {
  if (!(db as any).state || !(db as any).stateRelation) {
    throw new Error(
      "Prisma client не сгенерирован с моделью State/StateRelation. " +
      "Выполните: `bun run db:generate` (или `npx prisma generate`), затем `bun run db:push`."
    );
  }
}