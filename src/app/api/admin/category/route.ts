export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Use raw query to bypass stale Prisma Client cache which strips unknown fields
    const rawCategories: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Category" ORDER BY name ASC`);
    const categories = rawCategories.map(c => ({
      ...c,
      active: Boolean(c.active)
    }));
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { id, name, leadPrice, subscriptionPrice, paymentMode, active, plusKeywords, minusKeywords, ttlMinutes, imageUrl } = data;

    let category;
    const ttlVal = parseInt(ttlMinutes, 10) || 1440;
    
    // Payload WITHOUT ttlMinutes and imageUrl to prevent Prisma schema cache errors
    const payload = {
      name,
      leadPrice: parseFloat(leadPrice || 0),
      subscriptionPrice: parseFloat(subscriptionPrice || 0),
      paymentMode,
      active: active ?? true,
      plusKeywords: plusKeywords || null,
      minusKeywords: minusKeywords || null,
      days: 30
    };

    console.log('API PAYLOAD (STRICT):', payload);
    const safeImageUrl = imageUrl ? `'${imageUrl.replace(/'/g, "''")}'` : 'NULL';

    if (id) {
      category = await prisma.category.update({
        where: { id },
        data: payload,
      });
      // Raw update for ttlMinutes and imageUrl to bypass stale Prisma client cache
      await prisma.$executeRawUnsafe(`UPDATE "Category" SET "ttlMinutes" = ${ttlVal}, "imageUrl" = ${safeImageUrl} WHERE id = '${id}'`);
    } else {
      const slug = name.toLowerCase()
        .trim()
        .replace(/[^a-zа-яё0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
        
      category = await prisma.category.create({
        data: {
          ...payload,
          slug: slug || `cat-${Date.now()}`,
        },
      });
      await prisma.$executeRawUnsafe(`UPDATE "Category" SET "ttlMinutes" = ${ttlVal}, "imageUrl" = ${safeImageUrl} WHERE id = '${category.id}'`);
    }

    return NextResponse.json(category);
  } catch (error: any) {
    console.error('DETAILED CATEGORY ERROR:', error);
    return NextResponse.json({ 
      error: 'Failed to update category', 
      details: error.message,
      code: error.code 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'No ID provided' }, { status: 400 });

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
