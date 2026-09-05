import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/auth/admin-guard';
import { MaxBotApiError, resolveMaxChannelByLink } from '@/lib/max-bot';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    return NextResponse.json(await prisma.maxBotChat.findMany({
      where: { active: true },
      orderBy: [{ kind: 'asc' }, { title: 'asc' }, { updatedAt: 'desc' }],
      select: { chatId: true, title: true, kind: true, active: true },
      take: 500,
    }));
  } catch (error) {
    console.error('[MAX BOT CHATS GET]', error);
    return NextResponse.json({ error: 'Не удалось загрузить MAX-чаты' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const body = await request.json() as unknown;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }

    const channel = await resolveMaxChannelByLink((body as Record<string, unknown>).link);
    const saved = await prisma.maxBotChat.upsert({
      where: { chatId: channel.chatId },
      create: {
        chatId: channel.chatId,
        title: channel.title,
        kind: channel.kind,
        active: true,
      },
      update: {
        title: channel.title,
        kind: channel.kind,
        active: true,
      },
      select: { chatId: true, title: true, kind: true, active: true },
    });

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 });
    }
    if (error instanceof MaxBotApiError) {
      const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('[MAX BOT CHATS POST]', error);
    return NextResponse.json({ error: 'Не удалось подключить MAX-канал' }, { status: 500 });
  }
}
