import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyBearerSecret } from '@/lib/security/api-secret';
import { maxParser } from '@/services/max-parser';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!verifyBearerSecret(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const autoParseSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_auto' } });
    if (autoParseSetting?.value !== 'true') {
      return NextResponse.json({ skipped: true, message: 'Auto parse disabled' });
    }

    const intervalSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_interval' } });
    const intervalSeconds = Number.parseInt(intervalSetting?.value || '60', 10);
    const intervalMs = Math.max(10, Number.isFinite(intervalSeconds) ? intervalSeconds : 60) * 1000;

    const lastRunSetting = await prisma.setting.findUnique({ where: { key: 'maks_parser_last_run' } });
    const lastRun = lastRunSetting ? Number.parseInt(lastRunSetting.value, 10) : 0;
    const now = Date.now();

    if (now - lastRun < intervalMs) {
      return NextResponse.json({ skipped: true, message: 'Interval not reached yet' });
    }

    await prisma.setting.upsert({
      where: { key: 'maks_parser_last_run' },
      update: { value: now.toString() },
      create: { key: 'maks_parser_last_run', value: now.toString() },
    });

    console.log('[CRON API] Time reached. Starting parser...');

    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'true' },
      create: { key: 'syncing', value: 'true' },
    });

    const result = await maxParser.sync();

    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' },
    });

    if (result.logs) {
      await prisma.setting.upsert({
        where: { key: 'sync_logs' },
        update: { value: JSON.stringify(result.logs) },
        create: { key: 'sync_logs', value: JSON.stringify(result.logs) },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    await prisma.setting.upsert({
      where: { key: 'syncing' },
      update: { value: 'false' },
      create: { key: 'syncing', value: 'false' },
    });
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}
