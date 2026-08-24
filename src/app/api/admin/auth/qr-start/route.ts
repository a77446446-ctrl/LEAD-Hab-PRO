import { adminGuard } from '@/lib/auth/admin-guard';
import { prisma } from '@/lib/prisma';
import { encryptProxyUrl, parserSessionDirectory, sessionFileName } from '@/lib/parser-accounts';
import { normalizeProxyUrl } from '@/lib/proxy';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  let accountId: string | null = null;
  try {
    const body = await req.json() as { proxy?: unknown };
    const proxy = body.proxy === 'direct' || body.proxy === '' || body.proxy == null
      ? 'direct'
      : normalizeProxyUrl(body.proxy);
    if (!proxy) throw new Error('Прокси не задан');

    const recentAuthorizations = await prisma.maksAccount.count({
      where: { status: 'AUTHORIZING', createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
    });
    if (recentAuthorizations >= 3) {
      return NextResponse.json({ error: 'Уже запущено слишком много авторизаций' }, { status: 429 });
    }

    const sessionId = randomUUID();
    const account = await prisma.maksAccount.create({
      data: {
        name: `Аккаунт ${sessionId.slice(0, 8)}`,
        sessionFile: sessionFileName(sessionId),
        proxyString: encryptProxyUrl(proxy),
        status: 'AUTHORIZING',
        active: false,
      },
    });
    accountId = account.id;

    const scriptPath = path.join(process.cwd(), 'scripts', 'auth_manager.py');
    const child = spawn('python', [scriptPath, sessionId], {
      cwd: process.cwd(),
      detached: true,
      shell: false,
      stdio: 'ignore',
      windowsHide: false,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PARSER_PROXY_URL: proxy,
        PARSER_SESSIONS_DIR: parserSessionDirectory(),
      },
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    return NextResponse.json({ success: true, accountId: account.id });
  } catch (error) {
    if (accountId) await prisma.maksAccount.delete({ where: { id: accountId } }).catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Не удалось запустить авторизацию';
    console.error('MAKS Auth:', message);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}