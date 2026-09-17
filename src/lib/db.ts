import { PrismaClient } from "@prisma/client";

// Eén client per proces. Next hergebruikt modules bij hot reload, dus zonder deze
// cache op globalThis krijg je bij elke wijziging een nieuwe pool erbij.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
