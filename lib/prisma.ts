import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __splaroPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__splaroPrisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__splaroPrisma = prisma;
}
