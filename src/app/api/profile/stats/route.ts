import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = cookies().get('maks_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const secret = new TextEncoder().encode(process.env.AUTH_SESSION_SECRET || 'this_is_a_very_secret_key_for_local_testing_that_is_at_least_32_chars');
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub as string;

    const [purchasedLeads, purchases] = await Promise.all([
      prisma.purchase.count({ where: { userId } }),
      prisma.purchase.findMany({ where: { userId }, select: { price: true } })
    ]);

    const totalSpent = purchases.reduce((sum, p) => sum + (p.price || 0), 0);

    return NextResponse.json({
      purchasedLeads,
      totalSpent
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
