import { PrismaClient } from '@prisma/client';

// Make all BigInt values JSON-serializable as strings (token IDs, prices, etc.)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// Validate DATABASE_URL early so a missing DB user fails with a clear message
// instead of a cryptic "User `` was denied access" error at query time.
if (process.env.DATABASE_URL) {
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (!dbUrl.username) {
      console.warn(
        '[db] DATABASE_URL is missing a database user. Add one, e.g. postgresql://<user>@localhost:5432/zion_marketplace'
      );
    }
  } catch {
    // Not a valid URL — Prisma will report its own error later.
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
