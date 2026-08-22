export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // BigInt serialization fix
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    const serializedUsers = users.map(user => ({
      ...user,
      maxId: user.maxId.toString(),
    }));

    return NextResponse.json(serializedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
