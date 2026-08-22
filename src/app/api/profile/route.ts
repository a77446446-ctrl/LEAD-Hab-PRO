export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // In a real app, we'd get the user ID from the session/token
    // For now, fetching the first user (Admin/Master) for demo purposes
    const user = await prisma.user.findFirst({
      include: {
        subscriptions: {
          include: { category: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Convert BigInt to string for JSON serialization
    const serializedUser = {
      ...user,
      maxId: user.maxId.toString(),
    };

    return NextResponse.json(serializedUser);
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
