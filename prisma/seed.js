const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { telegramId: 12345678n },
    update: {},
    create: {
      telegramId: 12345678n,
      name: 'Admin Master',
      role: 'ADMIN',
      balance: 10000,
    },
  });

  // 2. Create Categories
  const catElectric = await prisma.category.upsert({
    where: { slug: 'electric' },
    update: {},
    create: {
      name: 'Электрик',
      slug: 'electric',
      paymentMode: 'HYBRID',
      leadPrice: 100,
      subscriptionPrice: 300,
    },
  });

  const catPlumber = await prisma.category.upsert({
    where: { slug: 'plumber' },
    update: {},
    create: {
      name: 'Сантехник',
      slug: 'plumber',
      paymentMode: 'LEAD',
      leadPrice: 150,
    },
  });

  // 3. Create Leads
  await prisma.lead.createMany({
    data: [
      {
        title: '🔥 Срочно нужен электрик',
        rawText: 'Замена проводки в 2ккв',
        city: 'Москва',
        categoryId: catElectric.id,
        score: 95,
        price: 100,
        status: 'NEW',
      },
      {
        title: 'Установка смесителя',
        rawText: 'Нужно поставить кран на кухне',
        city: 'СПб',
        categoryId: catPlumber.id,
        score: 80,
        price: 150,
        status: 'NEW',
      },
    ],
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
