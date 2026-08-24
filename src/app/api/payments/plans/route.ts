import { NextResponse } from 'next/server';
import { AuthenticationError, requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await requireCurrentUser();
    const categories = await prisma.category.findMany({
      where: { active: true, subscriptionPrice: { gt: 0 } },
      select: { id: true, name: true, subscriptionPrice: true, days: true }, orderBy: { name: 'asc' },
    });
    return NextResponse.json({ categories, topupPresets: [300, 500, 1000, 3000] });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: 'Не удалось загрузить тарифы' }, { status: 500 });
  }
}
