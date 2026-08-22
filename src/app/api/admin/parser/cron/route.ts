import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { maxParser } from '@/services/max-parser';

export async function POST() {
  try {
    const autoParseSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_auto' } });
    if (autoParseSetting?.value !== 'true') {
      return NextResponse.json({ skipped: true, message: 'Auto parse disabled' });
    }

    const intervalSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_interval' } });
    const intervalMs = parseInt(intervalSetting?.value || '60') * 1000;

    const lastRunSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_last_run' } });
    const lastRun = lastRunSetting ? parseInt(lastRunSetting.value) : 0;
    const now = Date.now();

    if (now - lastRun < intervalMs) {
      return NextResponse.json({ skipped: true, message: 'Interval not reached yet' });
    }

    await prisma.setting.upsert({
      where: { key: 'maks_parser_last_run' },
      update: { value: now.toString() },
      create: { key: 'maks_parser_last_run', value: now.toString() }
    });

    console.log('[CRON API] Time reached. Starting parser...');

    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'true' },
      create: { key: 'syncing', value: 'true' }
    });

    const result = await maxParser.sync();
    
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' }
    });

    if (result.logs) {
      await prisma.setting.upsert({
         where: { key: 'sync_logs' },
         update: { value: JSON.stringify(result.logs) },
         create: { key: 'sync_logs', value: JSON.stringify(result.logs) }
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' }
    });
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}