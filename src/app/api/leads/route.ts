export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = String((error as any)?.message || error || '').toLowerCase();
      const transient =
        msg.includes('connection terminated') ||
        msg.includes('connection timeout') ||
        msg.includes('tls') ||
        msg.includes('econnrefused');
      if (!transient || i === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw lastError;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const purchasedBy = searchParams.get('purchasedBy');
    const status = searchParams.get('status');
    const takeParam = Number(searchParams.get('take') || '200');
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 1000) : 200;

    let whereClause: any = {};
    if (categoryId && categoryId !== 'all') {
      whereClause.categoryId = categoryId;
    }
    
    if (purchasedBy) {
      whereClause.purchases = {
        some: { userId: purchasedBy }
      };
      if (!status) {
        whereClause.status = 'SOLD';
      }
    }

    if (status) {
      whereClause.status = status;
    }

    const leads = await withRetry(() =>
      prisma.lead.findMany({
        where: whereClause,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          rawText: true,
          phone: true,
          city: true,
          categoryId: true,
          sourceChat: true,
          score: true,
          price: true,
          status: true,
          createdAt: true,
        },
      })
    );

    const categoryIds = Array.from(new Set(leads.map((l) => l.categoryId)));
    const categories = categoryIds.length
      ? await withRetry(() =>
          prisma.$queryRawUnsafe(`SELECT id, name, slug, "paymentMode", "imageUrl" FROM "Category" WHERE id IN (${categoryIds.map(id => `'${id}'`).join(',')})`) as Promise<any[]>
      )
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const enriched = leads.map((lead) => ({
      ...lead,
      category: categoryMap.get(lead.categoryId) || null,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}
