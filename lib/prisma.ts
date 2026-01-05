// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Prevent exhausting your DB connections during Next.js dev hot-reloads
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // optional: logs can be helpful while building
    // log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
