import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: true
      },
      orderBy: { createdAt: 'desc' },
    });

    const serializedTransactions = transactions.map(t => ({
      ...t,
      user: {
        ...t.user,
        maxId: t.user.maxId.toString()
      }
    }));

    return NextResponse.json(serializedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
