import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma2: PrismaClient | undefined;
};

const adapter = new PrismaLibSql({
  url: 'file:dev.db',
});

export const prisma =
  globalForPrisma.prisma2 ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma2 = prisma;
}
