import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/auth/admin-guard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        maxId: true,
        name: true,
        role: true,
        balance: true,
        rating: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users.map((user) => ({
      id: user.id,
      maxId: user.maxId.toString(),
      name: user.name,
      role: user.role,
      balance: user.balance.toFixed(2),
      rating: user.rating,
      createdAt: user.createdAt,
    })));
  } catch (error) {
    console.error('Не удалось загрузить пользователей:', error);
    return NextResponse.json({ error: 'Не удалось загрузить пользователей' }, { status: 500 });
  }
}
