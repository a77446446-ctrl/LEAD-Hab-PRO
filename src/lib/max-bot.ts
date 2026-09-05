import { timingSafeEqual } from 'node:crypto';
import { extractContactInfo, redactContactInfo } from '@/lib/redact-contact';

const MAX_API_BASE_URL = 'https://platform-api2.max.ru';
const MAX_MESSAGE_LIMIT = 4_000;
const MAX_ID_LIMIT = 9_223_372_036_854_775_807n;
const MIN_MAX_ID = -9_223_372_036_854_775_808n;

export type MaxRecipientType = 'USER' | 'CHAT';

export interface LeadMessageData {
  id: string;
  title: string;
  rawText: string;
  city: string;
  price: number;
  category: {
    name: string;
    paymentMode: string;
  };
}

export interface MaxMessagePayload {
  text: string;
  attachments?: Array<{
    type: 'inline_keyboard';
    payload: {
      buttons: Array<Array<{
        type: 'link';
        text: string;
        url: string;
      }>>;
    };
  }>;
  notify?: boolean;
}

export interface MaxChannelInfo {
  chatId: string;
  title: string | null;
  kind: 'CHANNEL';
  active: boolean;
  isPublic: boolean;
  link: string;
}

export class MaxBotApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function normalizeMaxNumericId(value: unknown): string | null {
  const raw = typeof value === 'string'
    ? value.trim()
    : typeof value === 'bigint'
      ? value.toString()
      : typeof value === 'number' && Number.isSafeInteger(value)
        ? String(value)
        : '';
  if (!/^-?\d{1,19}$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    if (parsed === 0n || parsed < MIN_MAX_ID || parsed > MAX_ID_LIMIT) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeMaxChannelLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > 512) return null;

  const candidate = raw.startsWith('@')
    ? `https://max.ru/${raw.slice(1)}`
    : /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw.replace(/^\/+/, '')}`;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || hostname !== 'max.ru') return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return null;
    const link = decodeURIComponent(segments[0]).replace(/^@/, '');
    return /^[A-Za-z][A-Za-z0-9_-]{1,127}$/.test(link) ? link : null;
  } catch {
    return null;
  }
}

function exactChatId(rawBody: string, fallback: unknown): string | null {
  const match = rawBody.match(/"chat_id"\s*:\s*(?:"(-?\d{1,19})"|(-?\d{1,19}))/);
  return normalizeMaxNumericId(match?.[1] || match?.[2] || fallback);
}

export async function resolveMaxChannelByLink(value: unknown): Promise<MaxChannelInfo> {
  const token = (process.env.MAX_BOT_TOKEN || '').trim();
  if (!token) throw new MaxBotApiError('MAX_BOT_TOKEN не настроен', 503, true);

  const link = normalizeMaxChannelLink(value);
  if (!link) {
    throw new MaxBotApiError('Укажите публичную ссылку канала вида https://max.ru/channel_name', 400, false);
  }

  let response: Response;
  try {
    response = await fetch(`${MAX_API_BASE_URL}/chats/${encodeURIComponent(link)}`, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MaxBotApiError('MAX API временно недоступен', 503, true);
  }

  const rawBody = await response.text();
  const result = (() => {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();

  if (!response.ok || !result) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new MaxBotApiError(`MAX не смог открыть канал по ссылке, HTTP ${response.status}`, response.status, retryable);
  }

  const chatId = exactChatId(rawBody, result.chat_id);
  if (!chatId) throw new MaxBotApiError('MAX вернул некорректный chat_id канала', 502, true);
  if (result.type !== 'channel') {
    throw new MaxBotApiError('По этой ссылке найден не канал MAX', 400, false);
  }
  if (result.status !== 'active') {
    throw new MaxBotApiError('Бот не является активным участником этого канала', 409, false);
  }
  if (result.is_public !== true) {
    throw new MaxBotApiError('Канал должен быть публичным', 409, false);
  }

  return {
    chatId,
    title: typeof result.title === 'string' && result.title.trim()
      ? result.title.trim().slice(0, 200)
      : null,
    kind: 'CHANNEL',
    active: true,
    isPublic: true,
    link: `https://max.ru/${link}`,
  };
}

export function verifyMaxWebhookSecret(actual: string | null, expected = process.env.MAX_WEBHOOK_SECRET): boolean {
  if (!expected || !actual) return false;
  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function getBotUsername(): string {
  const username = (process.env.MAX_BOT_USERNAME || '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{1,63}$/.test(username)) {
    throw new Error('MAX_BOT_USERNAME не настроен');
  }
  return username;
}

export function buildMaxBotLink(): string {
  return `https://max.ru/${getBotUsername()}`;
}

export function buildMaxMiniAppLink(payload: string): string {
  const username = getBotUsername();  if (!/^[A-Za-z0-9_-]{1,512}$/.test(payload)) {
    throw new Error('Некорректный payload Mini App');
  }
  return `https://max.ru/${username}?startapp=${payload}`;
}

function priceLabel(lead: LeadMessageData): string {
  if (['SUB', 'SUBSCRIPTION', 'PRO'].includes(lead.category.paymentMode)) return 'по подписке PRO';
  return lead.price > 0 ? `${lead.price.toFixed(2).replace(/\.00$/, '')} ₽` : 'бесплатно';
}

function keyboard(buttons: Array<{text: string, url: string}>): MaxMessagePayload['attachments'] {
  return [{
    type: 'inline_keyboard',
    payload: { buttons: buttons.map(b => [{ type: 'link', text: b.text, url: b.url }]) },
  }];
}

const MAP_REGEX = /(https?:\/\/(?:yandex\.(?:ru|com)\/maps|maps\.yandex\.(?:ru|com)|2gis\.(?:ru|com)|go\.2gis\.com|maps\.google|goo\.gl\/maps)[^\s]*)/gi;

function formatHiddenContacts(text: string): string {
  return text
    .replace(/\[контакт скрыт:phone\]/g, '📞 [КОНТАКТ СКРЫТ]')
    .replace(/\[контакт скрыт:link\]/g, '🔗 [ССЫЛКА СКРЫТА]')
    .replace(/\[контакт скрыт\]/g, '🔒 [КОНТАКТ СКРЫТ]');
}

export function buildLeadTeaserMessage(lead: LeadMessageData): MaxMessagePayload {
  const mapLinks = Array.from(new Set(lead.rawText.match(MAP_REGEX) || []));
  const rawWithoutMaps = lead.rawText.replace(MAP_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
  
  const title = formatHiddenContacts(truncate(redactContactInfo(lead.title, true), 180));
  const description = formatHiddenContacts(truncate(redactContactInfo(rawWithoutMaps, true), 1_200));
  
  const text = truncate([
    '🆕 Новый заказ',
    '',
    `Категория: ${lead.category.name}`,
    `Город: ${lead.city?.toUpperCase() === 'НЕ УКАЗАН' ? 'в тексте заказа' : lead.city}`,
    `Стоимость: ${priceLabel(lead)}`,
    '',
    title,
    description,
    '',
    'Контакт скрыт до получения лида.',
  ].join('\n'), MAX_MESSAGE_LIMIT);

  const buttons = [];
  if (mapLinks.length > 0) {
    buttons.push({ text: '🗺️ Карта объекта', url: mapLinks[0] });
  }
  buttons.push({ text: '[ ЗАБРАТЬ КОНТАКТ ]', url: buildMaxMiniAppLink(`lead_${lead.id}`) });

  return {
    text,
    attachments: keyboard(buttons),
    notify: true,
  };
}

export function buildPurchaseMessage(lead: LeadMessageData): MaxMessagePayload {
  const contacts = extractContactInfo(`${lead.title}\n${lead.rawText}`);
  const mapLinks = Array.from(new Set(lead.rawText.match(MAP_REGEX) || []));
  const rawWithoutMaps = lead.rawText.replace(MAP_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();

  const text = truncate([
    '✅ Контакт получен',
    '',
    lead.title,
    `Категория: ${lead.category.name}`,
    `Город: ${lead.city?.toUpperCase() === 'НЕ УКАЗАН' ? 'в тексте заказа' : lead.city}`,
    ...(contacts.length > 0 ? [`Контакты: ${contacts.join(', ')}`] : []),
    '',
    rawWithoutMaps,
    '',
    'Лид сохранён в разделе «Мои лиды».',
  ].join('\n'), MAX_MESSAGE_LIMIT);

  const buttons = [];
  if (mapLinks.length > 0) {
    buttons.push({ text: '🗺️ Карта объекта', url: mapLinks[0] });
  }
  buttons.push({ text: 'Открыть мои лиды', url: buildMaxMiniAppLink(`purchase_${lead.id}`) });

  return {
    text,
    attachments: keyboard(buttons),
    notify: true,
  };
}

export function buildWelcomeMessage(): MaxMessagePayload {
  return {
    text: 'Добро пожаловать в «ПО ДЕЛАМ». Здесь будут приходить новые заказы по выбранным категориям и контакты купленных лидов.',
    attachments: keyboard([{ text: 'Открыть приложение', url: buildMaxMiniAppLink('home') }]),
    notify: true,
  };
}

export function buildCategorySubscribedMessage(categoryName: string): MaxMessagePayload {
  return {
    text: `Уведомления по категории «${truncate(categoryName, 100)}» включены. Новые заказы будут приходить в этот диалог без раскрытия контактов.`,
    attachments: keyboard([{ text: 'Открыть заказы', url: buildMaxMiniAppLink('home') }]),
    notify: true,
  };
}

export async function sendMaxMessage(
  recipientType: MaxRecipientType,
  recipientId: string,
  payload: MaxMessagePayload,
): Promise<string | null> {
  const token = (process.env.MAX_BOT_TOKEN || '').trim();
  if (!token) throw new MaxBotApiError('MAX_BOT_TOKEN не настроен', 503, true);
  const normalizedRecipientId = normalizeMaxNumericId(recipientId);
  if (!normalizedRecipientId) throw new MaxBotApiError('Некорректный MAX ID получателя', 400, false);
  if (!payload.text || payload.text.length > MAX_MESSAGE_LIMIT) {
    throw new MaxBotApiError('Некорректная длина сообщения MAX', 400, false);
  }

  const url = new URL('/messages', MAX_API_BASE_URL);
  url.searchParams.set(recipientType === 'USER' ? 'user_id' : 'chat_id', normalizedRecipientId);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MaxBotApiError('MAX API временно недоступен', 503, true);
  }

  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new MaxBotApiError(`MAX API вернул HTTP ${response.status}`, response.status, retryable);
  }

  const result = await response.json().catch(() => null) as {
    message?: { body?: { mid?: string }; mid?: string; message_id?: string };
  } | null;
  return result?.message?.body?.mid || result?.message?.mid || result?.message?.message_id || null;
}
