import { prisma } from './src/lib/prisma';
async function main() {
  await prisma.parserLease.updateMany({ where: { id: 'max-parser' }, data: { lockedUntil: null } });
  await prisma.setting.upsert({ where: { key: 'syncing' }, update: { value: 'false' }, create: { key: 'syncing', value: 'false' } });
  console.log('Locks cleared');
}
main().finally(() => prisma.$disconnect());
