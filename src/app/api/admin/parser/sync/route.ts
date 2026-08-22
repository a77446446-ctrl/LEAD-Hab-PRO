import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maxParser } from '@/services/max-parser';

export async function POST() {
  try {
    console.log('Starting manual parser sync...');
    
    // Set syncing = true in DB
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'true' },
      create: { key: 'syncing', value: 'true' }
    });

    const result = await maxParser.sync();
    
    // Set syncing = false in DB
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' }
    });

    // Save logs to DB so frontend can fetch them
    if (result.logs) {
      await prisma.setting.upsert({
         where: { key: 'sync_logs' },
         update: { value: JSON.stringify(result.logs) },
         create: { key: 'sync_logs', value: JSON.stringify(result.logs) }
      });
    }

    console.log('Parser sync result:', result);
    return NextResponse.json(result);
  } catch (error) {
    // Ensure we reset syncing flag on error
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' }
    });
    console.error('Error in manual sync:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
