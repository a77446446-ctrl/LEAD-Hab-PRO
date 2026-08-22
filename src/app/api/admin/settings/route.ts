import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    return NextResponse.json(enrichedSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
