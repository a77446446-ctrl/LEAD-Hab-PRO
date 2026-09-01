import { adminGuard } from '@/lib/auth/admin-guard';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const today = dateParam ? new Date(dateParam) : new Date();
    today.setHours(0, 0, 0, 0);

    const nextDay = new Date(today);
    nextDay.setDate(nextDay.getDate() + 1);

    const [revenueToday, newLeads, activeMasters, activeSubs] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: 'BUY',
          createdAt: { gte: today, lt: nextDay },
        },
        _sum: { amount: true },
      }),
      prisma.lead.count({
        where: { createdAt: { gte: today, lt: nextDay } },
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
