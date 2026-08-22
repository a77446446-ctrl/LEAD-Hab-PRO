export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenueToday, newLeads, activeMasters, activeSubs] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: 'BUY',
          createdAt: { gte: today },
        },
        _sum: { amount: true },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.user.count({
        where: { role: 'USER' },
      }),
      prisma.subscription.count({
        where: { expiresAt: { gt: new Date() } },
      }),
    ]);

    return NextResponse.json({
      revenueToday: Number(revenueToday._sum.amount || 0),
      newLeads,
      activeMasters,
      activeSubscriptions: activeSubs,
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
