const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.category.findMany({select: {name: true, imageUrl: true}}).then(console.log).finally(() => p.$disconnect());
