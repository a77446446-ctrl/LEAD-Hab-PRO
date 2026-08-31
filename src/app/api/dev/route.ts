import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const categories = await prisma.category.findMany();
  for (const cat of categories) {
    if (cat.leadPrice > 0 && cat.leadPrice < 10000) {
      await prisma.category.update({
        where: { id: cat.id },
        data: {
          leadPrice: cat.leadPrice * 100,
          subscriptionPrice: cat.subscriptionPrice * 100
        }
      });
    }
  }

  const leads = await prisma.lead.findMany();
  for (const lead of leads) {
    if (lead.price > 0 && lead.price < 10000) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { price: lead.price * 100 }
      });
    }
  }
  return NextResponse.json({ ok: true });
}
