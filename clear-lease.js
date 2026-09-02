const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.parserLease.deleteMany({}).then(() => console.log('Leases cleared')).catch(console.error).finally(() => p.$disconnect());
