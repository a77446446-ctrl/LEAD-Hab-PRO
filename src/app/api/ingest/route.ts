import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiService } from '@/services/ai';

export async function POST(request: Request) {
  try {
    const { rawText, source } = await request.json();

    if (!rawText) {
      return NextResponse.json({ error: 'Raw text is required' }, { status: 400 });
    }

    // 1. AI Processing
    const processed = await aiService.processLead(rawText);

    if (processed.isSpam) {
      return NextResponse.json({ status: 'ignored', reason: 'spam' });
    }

    // 2. Find Category
    const category = await prisma.category.findUnique({
      where: { slug: processed.category },
    });

    if (!category) {
      // Create category if it doesn't exist or assign to "other"
      return NextResponse.json({ status: 'ignored', reason: 'category_not_found' });
    }

    // 3. Save Lead
    const lead = await prisma.lead.create({
      data: {
        title: processed.title,
        rawText,
        city: processed.city,
        categoryId: category.id,
        score: processed.score,
        price: category.leadPrice,
        status: 'NEW',
      },
    });

    // 4. Trigger Notifications (Mock)
    console.log(`Push notification: New lead in ${category.name}!`);

    return NextResponse.json({ status: 'success', leadId: lead.id });
  } catch (error) {
    console.error('Ingestion failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
