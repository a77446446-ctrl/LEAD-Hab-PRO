import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [groups, failures, chats, deliveriesAll] = await Promise.all([
      prisma.botDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.botDelivery.findMany({
        where: { status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, kind: true, recipientType: true, attempts: true, lastError: true, updatedAt: true },
      }),
      prisma.maxBotChat.findMany({
        orderBy: { updatedAt: 'desc' },
        select: { chatId: true, title: true, kind: true, active: true, updatedAt: true },
      }),
      prisma.botDelivery.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
      })
    ]);
    return NextResponse.json({
      env: {
        MAX_BOT_TOKEN: Boolean(process.env.MAX_BOT_TOKEN),
        MAX_BOT_USERNAME: Boolean(process.env.MAX_BOT_USERNAME),
        MAX_WEBHOOK_SECRET: Boolean(process.env.MAX_WEBHOOK_SECRET),
        CRON_SECRET: Boolean(process.env.CRON_SECRET),
      },
      deliveries: Object.fromEntries(groups.map((group) => [group.status, group._count._all])),
      failures,
      chats,
      recent: deliveriesAll
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
