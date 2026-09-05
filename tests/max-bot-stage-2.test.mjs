import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

async function loadMaxBotModule() {
  const source = await read('src/lib/max-bot.ts');
const selfContained = source.replace(
    "import { extractContactInfo, redactContactInfo } from '@/lib/redact-contact';",
    "const CONTACT_PATTERN = /(https?:\\/\\/[^\\s]+|(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(?:\\/[^\\s]*)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}|@[a-zA-Z0-9_]+|(?:\\+?7|8)[\\s-]?\\(?\\d{3}\\)?[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}|\\b\\d{10}\\b)/gi; function redactContactInfo(value) { return value.replace(CONTACT_PATTERN, '[контакт скрыт]'); } function extractContactInfo(value) { return Array.from(new Set(value.match(CONTACT_PATTERN) || [])).slice(0, 20); }",
  );
  const output = ts.transpileModule(selfContained, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('MAX-ссылки и идентификаторы ограничены безопасным форматом', async () => {
  process.env.MAX_BOT_USERNAME = '@PoDelamBot';
  const bot = await loadMaxBotModule();
  assert.equal(bot.buildMaxMiniAppLink('lead_123-abc'), 'https://max.ru/PoDelamBot?startapp=lead_123-abc');
  assert.equal(bot.normalizeMaxNumericId('000123'), '123');
  assert.equal(bot.normalizeMaxNumericId('0'), null);
  assert.equal(bot.normalizeMaxNumericId('@mychannel'), null);
  assert.equal(bot.normalizeMaxNumericId('max.ru/mychannel'), null);
  assert.equal(bot.normalizeMaxChannelLink('https://max.ru/my_channel-1'), 'my_channel-1');
  assert.equal(bot.normalizeMaxChannelLink('max.ru/my_channel-1'), 'my_channel-1');
  assert.equal(bot.normalizeMaxChannelLink('@my_channel'), 'my_channel');
  assert.equal(bot.normalizeMaxChannelLink('http://max.ru/my_channel'), null);
  assert.equal(bot.normalizeMaxChannelLink('https://evil.example/my_channel'), null);
  assert.equal(bot.normalizeMaxChannelLink('https://max.ru/one/two'), null);
  assert.equal(bot.normalizeMaxNumericId('9223372036854775807'), '9223372036854775807');
  assert.equal(bot.normalizeMaxNumericId('-9223372036854775808'), '-9223372036854775808');
  assert.equal(bot.normalizeMaxNumericId(123n), '123');
  const categoryPage = await read('src/app/(admin)/admin/categories/page.tsx');
  assert.match(categoryPage, /Подключить публичный MAX-канал по ссылке/);
  assert.match(categoryPage, /<select[\s\S]*showcaseChatId/);
  assert.match(categoryPage, /method: 'POST'/);
  assert.doesNotMatch(categoryPage, /@mychannel/);
  assert.doesNotMatch(categoryPage, /max\.ru\/chat\//);
  assert.equal(bot.normalizeMaxNumericId(Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(bot.normalizeMaxNumericId('9223372036854775808'), null);
  assert.throws(() => bot.buildMaxMiniAppLink('bad payload'));
});

test('администратор может зарегистрировать публичный канал и выбрать его в категории', async () => {
  const [route, bot, webhookSetup] = await Promise.all([
    read('src/app/api/admin/bot/chats/route.ts'),
    read('src/lib/max-bot.ts'),
    read('scripts/setup-max-webhook.js'),
  ]);

  assert.match(route, /adminGuard/);
  assert.match(route, /resolveMaxChannelByLink/);
  assert.match(route, /maxBotChat\.upsert/);
  assert.match(route, /where: \{ active: true \}/);
  assert.match(bot, /platform-api2\.max\.ru/);
  assert.match(bot, /\/chats\/\$\{encodeURIComponent\(link\)\}/);
  assert.match(bot, /result\.status !== 'active'/);
  assert.match(bot, /result\.is_public !== true/);
  assert.match(webhookSetup, /"message_created"/);
});

test('MAX-канал по публичной ссылке сохраняет точный int64 chat_id', async () => {
  process.env.MAX_BOT_TOKEN = 'test-token';
  const bot = await loadMaxBotModule();
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    assert.equal(options.headers.Authorization, 'test-token');
    return new Response(JSON.stringify({
      chat_id: '9223372036854775807',
      title: 'Биржа заказов',
      type: 'channel',
      status: 'active',
      is_public: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const channel = await bot.resolveMaxChannelByLink('https://max.ru/orders_channel');
    assert.equal(channel.chatId, '9223372036854775807');
    assert.equal(channel.title, 'Биржа заказов');
    assert.match(requestedUrl, /platform-api2\.max\.ru\/chats\/orders_channel$/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.MAX_BOT_TOKEN;
  }
});

test('сохранение витринного чата проверяет MAX и ставит все NEW-лиды в очередь без дублей', async () => {
  const source = await read('src/app/api/admin/category/route.ts');
  assert.match(source, /maxBotChat\.findUnique/);
  assert.match(source, /knownChat\?\.active/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /status: \{ in: \['PENDING', 'RETRY', 'FAILED'\] \}/);
  assert.match(source, /status: 'RETRY'/);
  assert.match(source, /attempts: 0/);
  assert.match(source, /tx\.lead\.findMany/);
  assert.match(source, /status: 'NEW', deletedAt: null/);
  assert.match(source, /tx\.botDelivery\.createMany/);
  assert.match(source, /skipDuplicates: true/);
  assert.match(source, /offset \+= 500/);
});

test('тизер не раскрывает контакты, покупка возвращает полный текст', async () => {
  process.env.MAX_BOT_USERNAME = 'PoDelamBot';
  const bot = await loadMaxBotModule();
  const lead = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Позвоните +7 999 123-45-67',
    rawText: 'Телефон +7 999 123-45-67, @master, mail@example.ru, https://example.ru/order',
    city: 'Москва',
    price: 100,
    category: { name: 'Грузчики', paymentMode: 'LEAD' },
  };
  const teaser = bot.buildLeadTeaserMessage(lead);
  assert.doesNotMatch(teaser.text, /999 123|@master|mail@example|https:\/\/example/);
  assert.match(teaser.text, /контакт скрыт/i);
  assert.match(teaser.attachments[0].payload.buttons[0][0].url, /startapp=lead_/);

  const purchase = bot.buildPurchaseMessage(lead);
  assert.match(purchase.text, /\+7 999 123-45-67/);
  assert.match(purchase.attachments[0].payload.buttons[0][0].url, /startapp=purchase_/);
});

test('секрет webhook сравнивается точно', async () => {
  const bot = await loadMaxBotModule();
  assert.equal(bot.verifyMaxWebhookSecret('secret_123', 'secret_123'), true);
  assert.equal(bot.verifyMaxWebhookSecret('secret_124', 'secret_123'), false);
  assert.equal(bot.verifyMaxWebhookSecret(null, 'secret_123'), false);
});

test('сырой MAX webhook не сохраняется и не выдаётся диагностикой', async () => {
  const [webhook, diagnostics] = await Promise.all([
    read('src/app/api/webhooks/max/route.ts'),
    read('src/app/api/dev/bot-status/route.ts'),
  ]);

  assert.doesNotMatch(webhook, /lastWebhook/);
  assert.doesNotMatch(diagnostics, /lastWebhook/);
});

test('этап 2 использует webhook, outbox и транзакционные точки постановки', async () => {
  const [webhook, outbox, parser, ingest, purchase, cron, migration] = await Promise.all([
    read('src/app/api/webhooks/max/route.ts'),
    read('src/services/bot-outbox.ts'),
    read('src/services/max-parser.ts'),
    read('src/app/api/ingest/route.ts'),
    read('src/app/api/buy-lead/route.ts'),
    read('scripts/cron.js'),
    read('prisma/migrations/20260823020000_stage_2_max_bot/migration.sql'),
  ]);
  assert.match(webhook, /x-max-bot-api-secret/i);
  assert.match(webhook, /bot_started/);
  assert.match(outbox, /skipDuplicates: true/);
  assert.match(outbox, /status: 'PROCESSING'/);
  assert.match(outbox, /status: willRetry \? 'RETRY' : 'FAILED'/);
  assert.match(parser, /createLeadWithDeliveries/);
  assert.match(ingest, /createLeadWithDeliveries/);
  assert.match(purchase, /enqueuePurchaseDelivery/);
  assert.match(cron, /\/api\/internal\/bot\/dispatch/);
  assert.match(migration, /UNIQUE INDEX "BotDelivery_deduplicationKey_key"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});
