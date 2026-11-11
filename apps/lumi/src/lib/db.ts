import { PrismaClient } from '@/generated/prisma';

/**
 * Jedna Prisma instance na proces (dev hot-reload by jich jinak vytvořil
 * desítky a SQLite by hlásilo zámky).
 */
const globalForPrisma = globalThis as unknown as { lumiPrisma?: PrismaClient };

export const prisma = globalForPrisma.lumiPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.lumiPrisma = prisma;
