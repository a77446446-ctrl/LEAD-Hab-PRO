const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.maxBotChat.findMany().then(console.log).finally(() => prisma.$disconnect());
