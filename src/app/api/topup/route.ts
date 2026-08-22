import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, amount } = await request.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Minimum topup is 100 RUB' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update balance
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
        },
      });

      // 2. Record transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'TOPUP',
          amount,
        },
      });

      return user;
    });

    return NextResponse.json({ success: true, newBalance: result.balance });
  } catch (error) {
    console.error('Topup failed:', error);
    return NextResponse.json({ error: 'Topup failed' }, { status: 500 });
  }
}
