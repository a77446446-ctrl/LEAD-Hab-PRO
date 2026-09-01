import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildMaxDisplayName, verifyMaxInitData } from '@/lib/auth/max-init-data';
import { createSessionToken, sessionCookie, type SessionRole } from '@/lib/auth/session';
import { serializeCurrentUser } from '@/lib/auth/current-user';
import { isConfiguredAdminMaxId } from '@/lib/auth/admin-config';

export const runtime = 'nodejs';



export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > 12_000) {
      return NextResponse.json({ error: 'Запрос авторизации слишком большой' }, { status: 413 });
    }

    const parsedBody = await request.json() as unknown;
    const body = typeof parsedBody === 'object' && parsedBody !== null ? parsedBody as { initData?: unknown } : {};
    if (typeof body.initData !== 'string') {
      return NextResponse.json({ error: 'MAX не передал данные авторизации' }, { status: 400 });
    }

    const maxUser = verifyMaxInitData(body.initData, process.env.MAX_BOT_TOKEN || '');
    const displayName = buildMaxDisplayName(maxUser);
    
    // Read bonus from DB
    const bonusSetting = await prisma.setting.findUnique({ where: { key: 'maks_welcome_bonus_amount' } });
    const bonusEnabledSetting = await prisma.setting.findUnique({ where: { key: 'maks_welcome_bonus_enabled' } });
    const isBonusEnabled = bonusEnabledSetting?.value !== 'false';
    const bonusRub = bonusSetting?.value ? parseInt(bonusSetting.value, 10) : 300;
    const bonusKopecks = isBonusEnabled && bonusRub > 0 ? bonusRub : 0;

    const configuredAdmin = isConfiguredAdminMaxId(maxUser.maxId);
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      const current = await tx.user.upsert({
        where: { maxId: maxUser.maxId },
        create: {
          maxId: maxUser.maxId,
          name: displayName,
          role: configuredAdmin ? 'ADMIN' : 'USER',
          lastLoginAt: now,
        },
        update: {
          name: displayName,
          lastLoginAt: now,
          role: configuredAdmin ? 'ADMIN' : 'USER',
        },
      });

      const bonusGrant = await tx.user.updateMany({
        where: { id: current.id, onboardingBonusGrantedAt: null },
        data: {
          onboardingBonusGrantedAt: now,
          balance: { increment: bonusKopecks },
          
        },
      });

      if (bonusGrant.count === 1 && bonusKopecks > 0) {
        await tx.transaction.create({
          data: {
            userId: current.id,
            type: 'ONBOARDING_BONUS',
            
            amount: bonusKopecks,
          },
        });
      }

      const result = await tx.user.findUnique({
        where: { id: current.id },
        select: {
          id: true,
          maxId: true,
          name: true,
          role: true,
          balance: true,
          rating: true,
          notifyEnabled: true,
          botStartedAt: true,
          createdAt: true,
        },
      });
      if (!result) throw new Error('Не удалось создать профиль');
      return result;
    });

    const role: SessionRole = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
    const token = await createSessionToken(user.id, role);
    const response = NextResponse.json({ user: serializeCurrentUser(user) });
    response.cookies.set(sessionCookie.name, token, {
      ...sessionCookie.options,
      maxAge: sessionCookie.maxAge,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка авторизации';
    const configurationError = ['_SECRET', '_TOKEN', 'не настроен', 'ONBOARDING_BONUS'].some((value) => message.includes(value));
    const validationError = [
      'Некорректные данные запуска MAX',
      'Повторяющийся параметр MAX',
      'Подпись MAX',
      'Некорректное время авторизации MAX',
      'Срок действия авторизации MAX',
      'MAX не передал профиль пользователя',
      'Профиль MAX имеет некорректный формат',
      'MAX передал некорректный ID',
    ].some((value) => message.includes(value));

    console.error('[MAX AUTH]', message);
    if (configurationError) {
      return NextResponse.json({ error: 'Авторизация временно не настроена' }, { status: 503 });
    }
    if (validationError) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Не удалось выполнить авторизацию' }, { status: 500 });
  }
}
