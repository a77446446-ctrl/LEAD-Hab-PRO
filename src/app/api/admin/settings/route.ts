import { adminGuard } from '@/lib/auth/admin-guard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSecretSettingKey, SECRET_MASK } from '@/lib/security/secret-mask';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const settings = await prisma.setting.findMany();
    const leadCounts = await prisma.lead.groupBy({
      by: ['sourceChat'],
      _count: { _all: true },
      where: { sourceChat: { not: null } },
    });
    const countMap = new Map<string, number>(
      leadCounts
        .filter((row) => !!row.sourceChat)
        .map((row) => [row.sourceChat as string, row._count._all])
    );
    
    // Enrich parsing chats with lead counts
    const enrichedSettings = await Promise.all(settings.map(async (s) => {
      if (s.key === 'maks_parsing_chats') {
        try {
          const chats = JSON.parse(s.value);
          const richChats = chats.map((chat: any) => {
            const url = typeof chat === 'string' ? chat : chat.url;
            const count = countMap.get(url) ?? 0;
            if (typeof chat === 'string') {
              return { name: 'Новый чат', url: chat, parseAll: true, count };
            }
            return { ...chat, count };
          });
          return { ...s, value: JSON.stringify(richChats) };
        } catch (e) {
          return s;
        }
      }
      return s;
    }));

    return NextResponse.json(enrichedSettings.map((setting) =>
      isSecretSettingKey(setting.key) ? { ...setting, value: SECRET_MASK } : setting,
    ));
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const parsedBody = await req.json() as unknown;
    if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }
    const body = parsedBody as Record<string, unknown>;
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const value = String(body.value ?? '');
    if (!/^[a-z0-9_]{1,100}$/.test(key) || value.length > 100_000) {
      return NextResponse.json({ error: 'Некорректная настройка' }, { status: 400 });
    }
    if (isSecretSettingKey(key) && value === SECRET_MASK) {
      const existing = await prisma.setting.findUnique({ where: { key } });
      return NextResponse.json(existing ? { ...existing, value: SECRET_MASK } : { key, value: '' });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return NextResponse.json(isSecretSettingKey(setting.key) ? { ...setting, value: SECRET_MASK } : setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
