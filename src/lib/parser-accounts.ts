import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { normalizeProxyUrl } from '@/lib/proxy';
import { prisma } from '@/lib/prisma';

const ENCRYPTED_PREFIX = 'enc:v1:';
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_SESSION_BYTES = 10 * 1024 * 1024;

export type ParserAccountStatus =
  | 'AUTHORIZING'
  | 'ACTIVE'
  | 'COOLDOWN'
  | 'AUTH_REQUIRED'
  | 'PROXY_ERROR'
  | 'DISABLED';

function encryptionKey(): Buffer {
  const secret = process.env.PARSER_PROXY_ENCRYPTION_KEY || process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PARSER_PROXY_ENCRYPTION_KEY или AUTH_SESSION_SECRET должен содержать не менее 32 символов');
  }
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptProxyUrl(value: string | null): string | null {
  if (!value || value === 'direct') return value;
  const normalized = normalizeProxyUrl(value);
  if (!normalized) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptProxyUrl(value: string | null | undefined): string | null {
  if (!value || value === 'direct') return value || null;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return normalizeProxyUrl(value);
  const parts = value.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error('Повреждён зашифрованный прокси');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(parts[0], 'base64url'));
    decipher.setAuthTag(Buffer.from(parts[1], 'base64url'));
    const clear = Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8');
    return normalizeProxyUrl(clear);
  } catch {
    throw new Error('Не удалось расшифровать прокси: проверьте ключ шифрования');
  }
}

export function isEncryptedProxyUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(ENCRYPTED_PREFIX));
}

export function maskProxyUrl(value: string | null | undefined): string {
  if (!value || value === 'direct') return 'Прямое подключение';
  try {
    const url = new URL(value);
    const auth = url.username ? `${decodeURIComponent(url.username).slice(0, 2)}***:***@` : '';
    return `${url.protocol}//${auth}${url.hostname}:${url.port}`;
  } catch {
    return 'Прокси настроен';
  }
}

export function parserSessionDirectory(): string {
  const configured = process.env.PARSER_SESSIONS_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'sessions'));
}

export function assertSessionId(value: unknown): string {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) throw new Error('Некорректный идентификатор аккаунта');
  return value.toLowerCase();
}

export function sessionFileName(sessionId: string): string {
  return `${assertSessionId(sessionId)}.json`;
}

export function sessionFilePath(sessionId: string): string {
  return path.join(parserSessionDirectory(), sessionFileName(sessionId));
}

export function authArtifactDirectory(): string {
  return path.join(parserSessionDirectory(), '.auth');
}

export function authStatusFilePath(sessionId: string): string {
  return path.join(authArtifactDirectory(), `${assertSessionId(sessionId)}.status.json`);
}

export function authQrFilePath(sessionId: string): string {
  return path.join(authArtifactDirectory(), `${assertSessionId(sessionId)}.qr.png`);
}

export async function sessionFileExists(sessionId: string): Promise<boolean> {
  try {
    const stat = await fs.stat(sessionFilePath(sessionId));
    return stat.isFile() && stat.size > 0 && stat.size <= MAX_SESSION_BYTES;
  } catch {
    return false;
  }
}

export async function secureSessionFile(sessionId: string): Promise<void> {
  if (process.platform !== 'win32') await fs.chmod(sessionFilePath(sessionId), 0o600);
}

export function safeParserError(error: unknown): string {
  const source = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка');
  return source.replace(/\b(?:https?|socks5h?):\/\/[^\s]+/gi, '[proxy скрыт]').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}

export function parserCooldown(failures: number, kind: string): Date | null {
  if (kind === 'AUTH_REQUIRED') return null;
  const baseMinutes = kind === 'RATE_LIMITED' ? 60 : kind === 'PROXY_ERROR' ? 15 : 5;
  const multiplier = Math.min(16, 2 ** Math.max(0, failures - 1));
  return new Date(Date.now() + Math.min(6 * 60, baseMinutes * multiplier) * 60_000);
}
type SessionMetadata = { name: string; proxy: string | null };

async function readSessionMetadata(sessionId: string): Promise<SessionMetadata> {
  const file = sessionFilePath(sessionId);
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_SESSION_BYTES) throw new Error('Некорректный размер файла сессии');
  const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as { meta?: { name?: unknown; proxy?: unknown } };
  const rawName = typeof parsed.meta?.name === 'string' ? parsed.meta.name.trim().slice(0, 100) : '';
  return {
    name: rawName || 'Пользователь MAX',
    proxy: typeof parsed.meta?.proxy === 'string' ? parsed.meta.proxy : null,
  };
}

/** Импортирует legacy-файлы в PostgreSQL и шифрует старые proxyString. */
export async function synchronizeParserSessionFiles(): Promise<void> {
  const directory = parserSessionDirectory();
  await fs.mkdir(directory, { recursive: true });
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).slice(0, 1000);
  for (const file of files) {
    const sessionId = file.slice(0, -5);
    try {
      assertSessionId(sessionId);
      const meta = await readSessionMetadata(sessionId);
      const existing = await prisma.maksAccount.findUnique({ where: { sessionFile: file } });
      let storedProxy = existing?.proxyString || null;
      if (storedProxy && storedProxy !== 'direct' && !isEncryptedProxyUrl(storedProxy)) {
        storedProxy = encryptProxyUrl(decryptProxyUrl(storedProxy));
      } else if (!storedProxy && meta.proxy) {
        storedProxy = encryptProxyUrl(meta.proxy === 'direct' ? 'direct' : meta.proxy);
      }
      await prisma.maksAccount.upsert({
        where: { sessionFile: file },
        create: { name: meta.name, sessionFile: file, proxyString: storedProxy, active: true, status: 'ACTIVE' },
        update: {
          proxyString: storedProxy,
          ...(existing?.status === 'AUTHORIZING' || existing?.status === 'AUTH_REQUIRED'
            ? { active: true, status: 'ACTIVE', lastError: null }
            : {}),
        },
      });
      await secureSessionFile(sessionId);
    } catch (error) {
      console.error(`[PARSER-ACCOUNT] Файл ${file} пропущен:`, safeParserError(error));
    }
  }
}