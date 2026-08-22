export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, leadId } = await request.json();

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get user and lead
      let user = await tx.user.findUnique({ where: { id: userId } });
      const lead = await tx.lead.findUnique({ where: { id: leadId } });

      if (!lead) {
        throw new Error('Lead not found');
      }

      // DEV ONLY: auto-create the mock user if it doesn't exist
      if (!user && userId === '1') {
        user = await tx.user.create({
          data: {
            id: '1',
            maxId: 12345678,
            name: 'Master Lead',
            balance: 5000,
          }
        });
      }

      if (!user) {
        throw new Error('User not found');
      }

      if (lead.status !== 'NEW') {
        throw new Error('Lead is already sold or archived');
      }

      // 2. Check category rules & subscription
      const category = await tx.category.findUnique({ where: { id: lead.categoryId } });
      if (!category) throw new Error('Category not found');

      const sub = await tx.subscription.findFirst({
        where: {
          userId,
          categoryId: lead.categoryId,
          expiresAt: { gt: new Date() },
        },
      });

      if ((category.paymentMode === 'SUB' || category.paymentMode === 'PRO') && !sub) {
        throw new Error('Requires subscription');
      }

      const price = sub ? 0 : Number(lead.price);

      // 3. Check balance if not sub
      if (price > Number(user.balance)) {
        throw new Error('Insufficient balance');
      }

      // 4. Create purchase
      const purchase = await tx.purchase.create({
        data: {
          userId,
          leadId,
          price,
        },
      });

      // 5. Update user balance
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: price },
        },
      });

      // 6. Update lead status
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'SOLD',
        },
      });

      // 7. Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'BUY',
          amount: price,
        },
      });

      return purchase;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Purchase failed:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
