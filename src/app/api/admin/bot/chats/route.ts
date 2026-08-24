import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/auth/admin-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    return NextResponse.json(await prisma.maxBotChat.findMany({
      orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
      select: { chatId: true, title: true, kind: true, active: true, updatedAt: true },
    }));
  } catch (error) {
    console.error('[MAX BOT CHATS]', error);
    return NextResponse.json({ error: 'Не удалось загрузить MAX-чаты' }, { status: 500 });
  }
}
