import { PrismaClient } from '@prisma/client'

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