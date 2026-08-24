import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/auth/admin-guard';
import { prisma } from '@/lib/prisma';
import { normalizeMaxNumericId } from '@/lib/max-bot';

export const dynamic = 'force-dynamic';

const PAYMENT_MODES = new Set(['LEAD', 'SUB', 'SUBSCRIPTION', 'PRO', 'HYBRID']);
const SHOWCASE_KINDS = new Set(['PUBLIC', 'PRIVATE']);

function parseMoney(value: unknown, field: string): number {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    throw new Error(`Поле «${field}» содержит некорректную сумму`);
  }
  return Math.round(amount * 100) / 100;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeImageUrl(value: unknown): string | null {
  const imageUrl = optionalText(value, 2_048);
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) return imageUrl;
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Обрабатывается общей ошибкой ниже.
  }
  throw new Error('Некорректный URL изображения');
}

function getPrismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    return NextResponse.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }));
  } catch (error) {
    console.error('[ADMIN CATEGORY GET]', error);
    return NextResponse.json({ error: 'Не удалось загрузить категории' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const parsedBody = await request.json() as unknown;
    if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }
    const data = parsedBody as Record<string, unknown>;
    const id = optionalText(data.id, 100);
    const name = optionalText(data.name, 100);
    if (!name) return NextResponse.json({ error: 'Название категории обязательно' }, { status: 400 });

    const paymentMode = typeof data.paymentMode === 'string' ? data.paymentMode.toUpperCase() : 'LEAD';
    if (!PAYMENT_MODES.has(paymentMode)) {
      return NextResponse.json({ error: 'Некорректный режим оплаты' }, { status: 400 });
    }

    const ttlMinutes = Number(data.ttlMinutes ?? 1_440);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 525_600) {
      return NextResponse.json({ error: 'TTL должен быть от 1 до 525600 минут' }, { status: 400 });
    }

    const showcaseEnabled = data.showcaseEnabled === true;
    const showcaseChatId = normalizeMaxNumericId(data.showcaseChatId);
    if (showcaseEnabled && !showcaseChatId) {
      return NextResponse.json({ error: 'Для витрины нужен корректный числовой chat_id MAX' }, { status: 400 });
    }
    const showcaseKind = typeof data.showcaseKind === 'string' ? data.showcaseKind.toUpperCase() : 'PUBLIC';
    if (!SHOWCASE_KINDS.has(showcaseKind)) {
      return NextResponse.json({ error: 'Некорректный тип канала-витрины' }, { status: 400 });
    }
    const payload = {
      name,
      leadPrice: parseMoney(data.leadPrice, 'Цена лида'),
      subscriptionPrice: parseMoney(data.subscriptionPrice, 'Цена подписки'),
      paymentMode,
      active: typeof data.active === 'boolean' ? data.active : true,
      plusKeywords: optionalText(data.plusKeywords, 5_000),
      minusKeywords: optionalText(data.minusKeywords, 5_000),
      ttlMinutes,
      imageUrl: normalizeImageUrl(data.imageUrl),
      showcaseChatId,
      showcaseEnabled,
      showcaseKind,
    };

    const category = id
      ? await prisma.category.update({ where: { id }, data: payload })
      : await prisma.category.create({
          data: {
            ...payload,
            slug: name
              .normalize('NFKD')
              .toLowerCase()
              .replace(/[^\p{L}\p{N}]+/gu, '-')
              .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`,
          },
        });

    return NextResponse.json(category);
  } catch (error) {
    const code = getPrismaCode(error);
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Категория с таким названием или slug уже существует' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'Не удалось сохранить категорию';
    if (message.startsWith('Поле «') || message === 'Некорректный URL изображения') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[ADMIN CATEGORY POST]', error);
    return NextResponse.json({ error: 'Не удалось сохранить категорию' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id || id.length > 100) {
      return NextResponse.json({ error: 'Некорректный идентификатор категории' }, { status: 400 });
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getPrismaCode(error) === 'P2003') {
      return NextResponse.json({ error: 'Нельзя удалить категорию, пока к ней привязаны лиды' }, { status: 409 });
    }
    console.error('[ADMIN CATEGORY DELETE]', error);
    return NextResponse.json({ error: 'Не удалось удалить категорию' }, { status: 500 });
  }
}
