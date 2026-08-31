const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.parserLease.updateMany({ where: { id: 'max-parser' }, data: { lockedUntil: null } }).then(() => console.log('Lease cleared!'));
