import { prisma } from '@/lib/prisma';
import { aiService } from './ai';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';

async function withDbRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
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
      if (!transient || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
    }
  }
  throw lastError;
}

export const maxParser = {
  sync: async () => {
    console.log('MAKS Parser: Starting rotation sync...');
    const uiLogs: string[] = [];
    
    try {
      // 0. Cleanup expired leads
      uiLogs.push(`Очистка старых лидов...`);
      try {
        const categories = await prisma.category.findMany();
        let deletedCount = 0;
        
        // Helper to calculate TTL ignoring night hours (23:00 - 07:00 Moscow Time)
        const getCutoffDate = (nowMs: number, ttlMinutes: number): Date => {
          let minutesLeft = ttlMinutes;
          // Work in Moscow time (UTC+3). 
          // nowMs is absolute UNIX timestamp. 
          const MSK_OFFSET = 3 * 60 * 60 * 1000; 
          let current = new Date(nowMs + MSK_OFFSET); // shifted so getUTCHours() gives Moscow hour

          while (minutesLeft > 0) {
            let h = current.getUTCHours();
            // Night is 23:00 to 06:59
            if (h >= 23 || h < 7) {
              if (h >= 23) {
                current.setUTCHours(22, 59, 59, 999);
              } else {
                current.setUTCDate(current.getUTCDate() - 1);
                current.setUTCHours(22, 59, 59, 999);
              }
            } else {
              // Day time: 07:00 to 22:59
              let startOfDayMs = new Date(current).setUTCHours(7, 0, 0, 0);
              let diffMs = current.getTime() - startOfDayMs;
              let diffMinutes = Math.floor(diffMs / 60000);
              
              if (diffMinutes >= minutesLeft) {
                current.setTime(current.getTime() - minutesLeft * 60000);
                minutesLeft = 0;
              } else {
                current.setTime(startOfDayMs - 1); // jump to night
                minutesLeft -= diffMinutes;
              }
            }
          }
          // Shift back from Moscow time to UTC for the database query
          return new Date(current.getTime() - MSK_OFFSET);
        };

        for (const cat of categories) {
           const ttlMinutes = (cat as any).ttlMinutes || 1440; 
           const cutoffDate = getCutoffDate(Date.now(), ttlMinutes);
           const res = await prisma.lead.deleteMany({
              where: {
                 categoryId: cat.id,
                 status: { in: ['NEW', 'SPAM'] }, // Only delete unpurchased/spam leads
                 createdAt: { lt: cutoffDate }
              }
           });
           deletedCount += res.count;
        }
        uiLogs.push(`Удалено устаревших лидов: ${deletedCount}`);
      } catch (err) {
        console.error('Failed to cleanup leads:', err);
      }

      // 1. Get all active sessions
      const sessionDir = path.join(process.cwd(), 'sessions');
      console.log('Session directory:', sessionDir);
      let sessionFiles: string[] = [];
      try {
        sessionFiles = (await fs.readdir(sessionDir)).filter(f => f.endsWith('.json'));
        console.log('Found sessions:', sessionFiles);
        uiLogs.push(`Найдено сессий: ${sessionFiles.length}`);
      } catch (e) {
        const errMsg = `Папка сессий не найдена: ${e}`;
        console.error(errMsg);
        uiLogs.push(errMsg);
        return { success: false, message: errMsg, logs: uiLogs };
      }

      if (sessionFiles.length === 0) {
        const errMsg = 'Нет активных аккаунтов для парсинга';
        console.log(errMsg);
        uiLogs.push(errMsg);
        return { success: false, message: errMsg, logs: uiLogs };
      }

      // 2. Get target chats
      console.log('Fetching parsing chats from database...');
      const settings = await withDbRetry(() =>
        prisma.setting.findMany({
          where: { key: { in: ['maks_parsing_chats'] } }
        })
      ) as any[];
      console.log('Settings found:', settings.length);
      const config = settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {} as Record<string, string>);
      let parsingChats: any[] = [];
      try {
        const rawChats = JSON.parse(config.maks_parsing_chats || '[]');
        console.log('Raw chats parsed:', rawChats);
        parsingChats = rawChats
          .filter((c: any) => {
            // Filter out empty/invalid chats
            const url = typeof c === 'string' ? c : c?.url;
            return url && String(url).trim().length > 0;
          })
          .map((c: any) => {
            if (typeof c === 'string') {
              return { name: 'Чат', url: c.trim(), parseAll: true, count: 0 };
            }
            return {
              name: (c.name || 'Чат').substring(0, 100),  // Limit name length
              url: (c.url || '').trim(),
              parseAll: typeof c.parseAll === 'boolean' ? c.parseAll : true,
              count: typeof c.count === 'number' ? Math.max(0, c.count) : 0,
              lastParsedAt: c.lastParsedAt || null,
            };
          });
        console.log('Normalized chats:', parsingChats.map(c => ({ name: c.name, url: c.url.substring(0, 50) + '...' })));
        uiLogs.push(`Загружено чатов для парсинга: ${parsingChats.length}`);
      } catch (e) {
        const errMsg = `Ошибка парсинга конфигурации чатов: ${e}`;
        console.error(errMsg);
        uiLogs.push(errMsg);
        parsingChats = [];
      }

      if (parsingChats.length === 0) {
        const errMsg = 'Список чатов пуст';
        console.log(errMsg);
        uiLogs.push(errMsg);
        return { success: false, message: errMsg, logs: uiLogs };
      }

      let leadsCount = 0;
      let currentSessionIndex = 0;
      let configChanged = false;

    // 3. Process chats with session rotation
    for (const chat of parsingChats) {
      const chatUrlOriginal = chat.url || chat;
      let chatUrl = chatUrlOriginal;
      const chatDisplayName = chat.name || 'Новый чат';
      const parseAll = Boolean(chat.parseAll ?? true);

      // Auto-fix URL: ensure it uses web.max.ru
      if (typeof chatUrl === 'string' && chatUrl.includes('max.ru') && !chatUrl.includes('web.max.ru')) {
        chatUrl = chatUrl.replace('max.ru', 'web.max.ru');
        // Update URL in settings immediately
        const chatIndex = parsingChats.findIndex((c: any) => c.url === chatUrlOriginal);
        if (chatIndex !== -1) {
            parsingChats[chatIndex] = { ...parsingChats[chatIndex], url: chatUrl };
            configChanged = true;
        }
      }
      if (!chatUrl.startsWith('http')) chatUrl = 'https://' + chatUrl;

      // Pick current session
      const sessionFile = sessionFiles[currentSessionIndex];
      uiLogs.push(`Начинаю: ${chatDisplayName}...`);
      console.log(`MAKS Parser: Processing ${chatDisplayName} (${chatUrl}) using ${sessionFile}...`);

      try {
        const workerResult = await runPlaywrightParse(chatUrl, sessionFile);
        const { title: fetchedTitle, messages } = workerResult;
        
        // Update title if it's "New Chat" or significantly better
        if (fetchedTitle && !fetchedTitle.includes('Быстрое') && !fetchedTitle.includes('приложение') && (chatDisplayName === 'Новый чат' || fetchedTitle !== chatDisplayName)) {
           const chatIndex = parsingChats.findIndex((c: any) => (typeof c === 'string' ? c : c.url) === chatUrl);
           if (chatIndex !== -1) {
              if (typeof parsingChats[chatIndex] === 'string') {
                 parsingChats[chatIndex] = { name: fetchedTitle, url: chatUrl, parseAll: true };
              } else {
                 (parsingChats[chatIndex] as any).name = fetchedTitle;
              }
              configChanged = true;
              uiLogs.push(`Имя чата обновлено -> ${fetchedTitle}`);
           }
        }

        const activeTitle = fetchedTitle || chatDisplayName;

        if (messages.length === 0) {
          uiLogs.push(`[${activeTitle}] Нет новых сообщений`);
        } else {
          uiLogs.push(`[${activeTitle}] Найдено ${messages.length} сообщ.`);
        }

        // Filter and validate messages
        const validMessages = messages
          .filter(msg => {
            const text = (msg.text || '').trim();
            // Must be non-empty, not too short, not too long, no obvious spam patterns
            return text.length > 15 && 
                   text.length < 2000 && 
                   !text.match(/^[а-яА-ЯёЁ]+$/);  // Not just repeated letters
          })
          .map(msg => {
            let cleanMsgText = (msg.text || '').trim().substring(0, 1500);
            
            // Убираем название канала, если оно приклеилось в самом начале текста
            if (activeTitle && activeTitle.length > 5) {
               // Экранируем спецсимволы в названии чата
               const escapedTitle = activeTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
               const titlePattern = new RegExp('^' + escapedTitle + '\\s*\\n*', 'i');
               cleanMsgText = cleanMsgText.replace(titlePattern, '').trim();
            }

            // Убираем плашки пересылки из начала сообщения
            cleanMsgText = cleanMsgText.replace(/^(Переслано от:|Переслано:|Forwarded from:)\s*\n*.+?\n+/i, '').trim();

            // Убираем SEO-шапки каналов (например: "Работа СПБ Вакансии Халтура Шабашки...")
            const lines = cleanMsgText.split('\n');
            if (lines.length > 1) { // Удаляем только если это не единственная строка
               const firstLine = lines[0].toLowerCase();
               const seoWords = ['работа', 'ваканси', 'подработк', 'халтур', 'шабашк', 'каждый час', 'москва', 'спб', 'питер', 'жилье', 'область', 'тюмень', 'вахта', 'вахтовик'];
               let matchCount = 0;
               for (const w of seoWords) {
                  if (firstLine.includes(w)) matchCount++;
               }
               // Если в первой строке 3 и более слов-тэгов - это 100% название канала
               if (matchCount >= 3) {
                  lines.shift(); // Выкидываем эту строку
                  cleanMsgText = lines.join('\n').trim();
               }
            }

            return {
              ...msg,
              text: cleanMsgText
            };
          });

        for (const msg of validMessages) {
          try {
            const shortText = msg.text.substring(0, 40).replace(/\n/g, ' ') + '...';
            uiLogs.push(`>> Обработка: ${shortText}`);
            
            // ALWAYS process with AI to get dynamic categories
            const processed = await aiService.processLead(msg.text);
            uiLogs.push(`>> AI Категория: ${processed.category} (Заголовок: ${processed.title})`);
            console.log(`[AI-DEBUG] Parsed lead -> Title: "${processed.title}", Category: "${processed.category}"`);

            // Find category — explicitly check targetSlug FIRST in various forms
            const targetCatString = String(processed.category || 'other').trim();
            let category: any = await withDbRetry(() =>
              prisma.category.findFirst({
                where: {
                  OR: [
                    { slug: targetCatString },
                    { slug: targetCatString.toLowerCase() },
                    { name: targetCatString }
                  ]
                }
              })
            );

            if (!category) {
              category = await withDbRetry(() =>
                prisma.category.findFirst({
                  where: {
                    OR: [
                      { slug: 'other' },
                      { name: 'Другое' }
                    ]
                  }
                })
              );
            }

            // Try by name if slug didn't work
            if (!category) {
              category = await withDbRetry(() =>
                prisma.category.findFirst({
                  where: { name: { in: ['Другое', 'Прочее', 'Other'] } }
                })
              );
            }

            // Last resort: any category at all
            if (!category) {
              category = await withDbRetry(() => prisma.category.findFirst());
            }

            // Absolute last resort: create one (WITHOUT 'icon' field — it doesn't exist in schema)
            if (!category) {
              category = await withDbRetry(() =>
                prisma.category.create({
                  data: {
                    name: 'Другое',
                    slug: 'other',
                    leadPrice: 50
                  }
                })
              );
              uiLogs.push(`+ Создана категория "Другое"`);
            }

            if (!category) {
              uiLogs.push(`!! Категория не найдена, пропуск`);
              continue;
            }

            // Check for duplicates
            // Сравниваем по полностью очищенному тексту (cleanedText), из которого УЖЕ вырезаны
            // меняющиеся счетчики просмотров, время и кнопки. Это дает 100% стабильность.
            const stableText = processed.cleanedText || msg.text.trim();
            const existing = await withDbRetry(() =>
              prisma.lead.findFirst({
                where: { 
                  AND: [
                    { rawText: stableText },
                    { sourceChat: chatUrl }
                  ]
                }
              })
            );
            if (existing) {
              uiLogs.push(`>> Дублик пропущен`);
              continue;
            }

            // Contact strict check - if no phone, @username, or link is found, block it to prevent leaking traffic
            const hasContact = /(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b/.test(msg.text) || 
                               /@[a-zA-Z0-9_]+/.test(msg.text) || 
                               /https?:\/\/[^\s]+/.test(msg.text) ||
                               /(?:vk\.com|t\.me)\/[^\s]+/.test(msg.text);

            if (!hasContact) {
              uiLogs.push(`>> Отклонено: Нет прямых контактов`);
              continue;
            }

            // Spam filter (only in non-parseAll mode)
            if (!parseAll && (processed.isSpam || processed.score < 30)) {
              uiLogs.push(`>> Спам отфильтрован`);
              continue;
            }

            // Save lead
            const lead = await withDbRetry(() =>
              prisma.lead.create({
                data: {
                  title: processed.title || 'Новое сообщение',
                  rawText: processed.cleanedText || msg.text,
                  city: processed.city || 'Не указан',
                  categoryId: category.id,
                  sourceChat: chatUrl,
                  score: parseAll ? 100 : Math.min(100, Math.max(0, processed.score || 50)),
                  price: category.leadPrice ?? 100,
                  status: processed.isSpam ? 'SPAM' : 'NEW'
                }
              })
            );
            uiLogs.push(`>> ✓ Сохранено`);
            leadsCount++;

          } catch (msgError: any) {
            const errMsg = msgError?.message || String(msgError);
            uiLogs.push(`!! ОШИБКА: ${errMsg.substring(0, 80)}`);
            console.error(`[PARSER] Message processing error:`, msgError);
          }
        }

        // AFTER processing the chat, update the global counter for this chat in settings
        const totalLeadsForThisChat = await withDbRetry(() =>
          prisma.lead.count({
             where: { sourceChat: chatUrl }
          })
        );
        
        const chatIdx = parsingChats.findIndex(c => c.url === chatUrl);
        if (chatIdx !== -1) {
          parsingChats[chatIdx] = {
            ...parsingChats[chatIdx],
            count: totalLeadsForThisChat,
            lastParsedAt: new Date().toISOString(),
          };
          configChanged = true;
        }

        // Rotate to next session for the next chat
        currentSessionIndex = (currentSessionIndex + 1) % sessionFiles.length;
        
      } catch (error) {
        console.error(`MAKS Parser: Error with session ${sessionFile} for chat ${chatUrl}:`, error);
      }
    }
    
    if (configChanged) {
       await withDbRetry(() =>
         prisma.setting.update({
            where: { key: 'maks_parsing_chats' },
            data: { value: JSON.stringify(parsingChats) }
         })
       );
    }
    
      uiLogs.push(`ГОТОВО. Всего лидов: ${leadsCount}`);
      return { success: true, leadsCount, logs: uiLogs };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('MAKS Parser FATAL ERROR:', errMsg);
      uiLogs.push(`ОШИБКА: ${errMsg}`);
      return { success: false, message: errMsg, logs: uiLogs };
    }
  }
};

import { spawn } from 'child_process';

async function runPlaywrightParse(chatUrl: string, sessionFile: string): Promise<any> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts/parser_worker.py');
    const sessionId = sessionFile.replace('.json', '');
    let finished = false;
    
    console.log(`[PARSER] Spawning worker: python "${scriptPath}" "${sessionId}" "${chatUrl}"`);
    
    const { spawn } = require('child_process');
    const child = spawn('python', [scriptPath, sessionId, chatUrl], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';
    const timeoutMs = 120000;
    const timeoutHandle = setTimeout(() => {
      if (finished) return;
      finished = true;
      console.error(`[PARSER-TIMEOUT] Worker timed out after ${timeoutMs}ms for ${chatUrl}`);
      try { child.kill(); } catch (e) {}
      resolve({ title: null, messages: [], source_chat: chatUrl });
    }, timeoutMs);

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      stderr += msg;
      if (msg.includes('DEBUG') || msg.includes('Found')) {
        console.log(`[WORKER-DEBUG] ${msg.trim()}`);
      }
    });

    child.on('close', (code: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      if (code !== 0) {
        console.error(`[WORKER-ERROR] Exited with code ${code}. Stderr: ${stderr}`);
        resolve({ title: null, messages: [], source_chat: chatUrl });
        return;
      }

      try {
        // Find JSON in stdout by looking for lines that start with {
        const lines = stdout.trim().split('\n');
        let jsonStr = null;
        
        // Try the last line first (ideal case)
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{')) {
            jsonStr = line;
            break;
          }
        }
        
        if (!jsonStr) {
          console.error('[PARSER-FATAL] No JSON found in stdout');
          console.error('[PARSER-FATAL] Raw stdout:', stdout);
          resolve({ title: null, messages: [], source_chat: chatUrl });
          return;
        }
        
        const results = JSON.parse(jsonStr);
        // Validate structure
        if (!results.title || !Array.isArray(results.messages)) {
          console.error('[PARSER-FATAL] Invalid results structure:', results);
          resolve({ title: null, messages: [], source_chat: chatUrl });
          return;
        }
        resolve(results);
      } catch (e) {
        console.error('[PARSER-FATAL] Failed to parse JSON from worker output.');
        console.error('[PARSER-FATAL] Raw stdout:', stdout);
        console.error('[PARSER-FATAL] Error:', e);
        resolve({ title: null, messages: [], source_chat: chatUrl });
      }
    });

    child.on('error', (err: any) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      console.error('[PARSER-FATAL] Failed to start child process:', err);
      resolve({ title: null, messages: [], source_chat: chatUrl });
    });
  });
}
