import { redactContactInfo } from '@/lib/redact-contact';
import { prisma } from '@/lib/prisma';

export interface RawLead {
  text: string;
  source?: string;
}

export interface ProcessedLead {
  title: string;
  category: string;
  city: string;
  budget: string;
  score: number;
  isSpam: boolean;
  cleanedText?: string;
}

// Функция для очистки текста от технического мусора из интерфейса мессенджера
function cleanRawText(text: string): string {
  if (!text) return '';
  // Убираем длинные линии из подчеркиваний, дефисов или звездочек (от 5 штук подряд)
  const noLinesText = text.replace(/[_*-]{5,}/g, ' ');
  
  const lines = noLinesText.split('\n');
  const cleanedLines = [];
  let inPromoBlock = false;
  
  for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed.length === 0) {
      if (!inPromoBlock) cleanedLines.push(line);
      continue;
    }
    
    // Проверяем начало рекламного блока
    if (/^(разместить объявление|подать объявление|опубликовать вакансию|размещение рекламы|для размещения|по поводу рекламы|добавить объявление)/i.test(trimmed)) {
      inPromoBlock = true;
      continue;
    }

    // Обработка строки контактов от скрапера
    if (trimmed.startsWith('Контакты (ссылки):')) {
      inPromoBlock = false; // Сброс рекламного блока
      
      // Вырезаем рекламные ссылки (боты, доски объявлений, каналы)
      const badLinksRegex = /https?:\/\/(t\.me\/[a-zA-Z0-9_]*bot\b|t\.me\/(?:rabota|job|vakans|channel|work|board|doska)[a-zA-Z0-9_]*\b|max\.ru\/channel_[a-zA-Z0-9_]*)/gi;
      let cleanLinks = trimmed.replace(badLinksRegex, '');
      
      // Подчищаем висящие запятые после удаления ссылок
      cleanLinks = cleanLinks.replace(/(\s*,\s*)+/g, ', ').replace(/:\s*,/g, ':').replace(/,\s*$/g, '').trim();
      
      if (cleanLinks === 'Контакты (ссылки):') {
        continue; // Если остались только пустые контакты, полностью убираем строку
      }
      trimmed = cleanLinks;
    } else if (inPromoBlock) {
      continue; // Пропускаем весь текст внутри рекламного блока
    }
    
    // Ищем строки-мусор (время, просмотры "1K", одиночные цифры-кнопки, "комментарии")
    const isTime = /^\d{1,2}:\d{2}$/.test(trimmed);
    const isViewsOrButtons = /^\d+([KkКк]?)$/.test(trimmed);
    const isComments = /комментари/i.test(trimmed) || /^💬/.test(trimmed);
    const isUIAction = /^(Скрыть|Меню|Поделиться|Переслать|Подписаться на канал)/i.test(trimmed);
    
    if (isTime || isViewsOrButtons || isComments || isUIAction) {
      continue; // Пропускаем мусорную строку
    }
    
    cleanedLines.push(trimmed);
  }
  
  return cleanedLines.join('\n').trim();
}

// Вспомогательная функция локального парсинга без ИИ
function fallbackScriptParse(rawText: string, categories: any[]): ProcessedLead {
  const lowerText = rawText.toLowerCase();

  // Базовый антиспам теперь проверяется глобально в processLead перед вызовом fallbackScriptParse
  const isSpam = false;

  // 2. Расширенный список городов России (с использованием границ слов \b для коротких аббревиатур)
  const cities: Record<string, RegExp[]> = {
    'Москва': [/москв/i, /\bмск\b/i],
    'Санкт-Петербург': [/санкт-петербург/i, /\bспб\b/i, /\bпитер/i, /ленинград/i],
    'Новосибирск': [/новосибирск/i, /\bнск\b/i],
    'Екатеринбург': [/екатеринбург/i, /\bекб\b/i],
    'Казань': [/казан/i],
    'Нижний Новгород': [/нижни.*новгород/i, /\bнн\b/i],
    'Тюмень': [/тюмен/i],
    'Краснодар': [/краснодар/i, /\bкрд\b/i],
    'Сочи': [/сочи/i],
    'Ростов-на-Дону': [/ростов/i, /\bрнд\b/i],
    'Уфа': [/\bуфа\b/i, /\bуфу\b/i, /\bуфе\b/i],
    'Самара': [/самар/i],
    'Челябинск': [/челябинск/i, /\bчел\b/i],
    'Омск': [/\bомск/i],
    'Красноярск': [/красноярск/i, /\bкрск\b/i],
    'Воронеж': [/воронеж/i],
    'Пермь': [/перм/i],
    'Волгоград': [/волгоград/i, /\bвлг\b/i],
    'Саратов': [/саратов/i],
    'Тольятти': [/тольятти/i, /\bтлт\b/i],
    'Ижевск': [/ижевск/i],
    'Барнаул': [/барнаул/i, /\bбрн\b/i],
    'Ульяновск': [/ульяновск/i, /\bулск\b/i],
    'Иркутск': [/иркутск/i, /\bирк\b/i],
    'Хабаровск': [/хабаровск/i, /\bхбр\b/i],
    'Ярославль': [/ярославл/i],
    'Владивосток': [/владивосток/i, /\bвдк\b/i, /\bвл\b/i],
    'Махачкала': [/махачкал/i],
    'Томск': [/томск/i],
    'Оренбург': [/оренбург/i],
    'Кемерово': [/кемеров/i],
    'Новокузнецк': [/новокузнецк/i, /\bнкз\b/i],
    'Рязань': [/рязан/i],
    'Астрахань': [/астрахан/i],
    'Набережные Челны': [/набережн.*челн/i, /\bчелн/i],
    'Пенза': [/пенз/i],
    'Липецк': [/липецк/i],
    'Киров': [/киров/i]
  };
  
  let detectedCity = 'Не указан'; // Если город не найден, лучше ставить "Не указан"
  for (const [city, regexes] of Object.entries(cities)) {
    if (regexes.some(regex => regex.test(lowerText))) {
      detectedCity = city;
      break;
    }
  }

  // 3. Определение категории по ключевым словам из БД
  let detectedCategory = 'other';
  let categoryName = 'Другое';
  for (const cat of categories) {
    if (cat.plusKeywords) {
      const keywords = cat.plusKeywords.split(',').map((k: string) => k.trim().toLowerCase());
      if (keywords.some((kw: string) => lowerText.includes(kw))) {
        detectedCategory = cat.slug;
        categoryName = cat.name;
        break;
      }
    }
  }

  // 4. Формирование сгенерированного заголовка
  // Используем начало сообщения как заголовок, чтобы сразу было понятно о чем речь
  const snippet = rawText.trim().replace(/\s+/g, ' ').substring(0, 50) + (rawText.length > 50 ? '...' : '');
  const title = snippet || 'Без названия';

  return {
    title,
    category: detectedCategory,
    city: detectedCity,
    budget: 'По договоренности',
    score: isSpam ? 0 : 80,
    isSpam,
    cleanedText: cleanRawText(rawText)
  };
}

export const aiService = {
  processLead: async (rawText: string): Promise<ProcessedLead> => {
    try {
      // 0. Глобальный антиспам (проверяется ДО любых ИИ или запасных скриптов)
      const spamSettings = await prisma.setting.findUnique({
        where: { key: 'maks_spam_keywords' }
      });
      const customSpam = spamSettings?.value || '';
      
      const lowerText = rawText.toLowerCase();
      
      // Базовые слова, отсеивающие РЕЗЮМЕ и РЕКЛАМУ УСЛУГ
      const defaultSpamWords = [
        'казино', 'ставки', 'крипта', 'заработок в интернете', 'эскорт', 'интим',
        'ищу работу', 'ищем работу', 'ищет работу', 'предоставляем услуги', 'оказываем услуги', 
        'выполним работы', 'выполняем работы', 'бригада ищет', 'предлагаю услуги', 'предлагаем услуги',
        'звоните в любое время', 'бесплатный выезд', 'качественно и недорого', 'гарантия качества',
        'раскрутка', 'продвижение', 'накрутка', 'таргет', 'маркетолог', 'помогу с', 'наша бригада'
      ];
      
      const userSpamWords = customSpam.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 2);
      const allSpamWords = [...defaultSpamWords, ...userSpamWords];
      
      if (allSpamWords.some(kw => lowerText.includes(kw))) {
         console.log('Global Anti-Spam triggered. Skipping processing.');
         return {
            title: 'Спам / Реклама / Резюме',
            category: 'other',
            city: 'Не определен',
            budget: '',
            score: 0,
            isSpam: true,
            cleanedText: cleanRawText(rawText)
         };
      }

      // 1. Fetch active categories and keywords from DB
      const dbCategories = await prisma.category.findMany({
        where: { active: true }
      });

      if (dbCategories.length === 0) {
        return fallbackScriptParse(rawText, []);
      }

      // 2. Проверяем, включен ли ИИ вообще
      const aiEnabledSetting = await prisma.setting.findUnique({
        where: { key: 'maks_ai_enabled' }
      });
      const isAiEnabled = aiEnabledSetting?.value === 'true';

      if (!isAiEnabled) {
        console.log('AI is disabled (Feature Toggle). Using local script parser.');
        return fallbackScriptParse(rawText, dbCategories);
      }

      console.log('AI is processing lead with DeepSeek (Dynamic Categories)');

      const aiKeySetting = await prisma.setting.findUnique({
        where: { key: 'maks_ai_api_key' }
      });
      const dbApiKey = aiKeySetting?.value?.trim();

      const categoriesList = dbCategories.map(c => 
        `ID: "${c.slug}" (Имя: ${c.name}, Ключи: ${c.plusKeywords || 'любые'})`
      ).join('\n');

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const hasDbKey = !!dbApiKey;
          const isOpenAIEnv = !!process.env.OPENAI_API_KEY;
          const apiKey = dbApiKey || (isOpenAIEnv ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY);
          const isOpenAI = !dbApiKey && isOpenAIEnv; 
          const apiUrl = isOpenAI ? 'https://api.openai.com/v1/chat/completions' : 'https://api.deepseek.com/chat/completions';
          const modelName = isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat';

          const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(apiUrl, {
              signal: controller.signal,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              temperature: 0.1, // Строгое соответствие
              messages: [
                {
                  role: 'system',
                  content: `Ты модератор лидов. Выдай только JSON.
КАТЕГОРИИ:
${categoriesList}

ПРАВИЛА:
1. category: ID подходящей категории из списка (или 'other').
2. title: Суть работы (без шапок, без воды). Пример: "Бригада кровельщиков", "Грузчики на склад". Максимум 4-6 слов.
3. city: Точный город, метро, район или населенный пункт из текста (например: "Санкт-Петербург", "Петергоф", "метро Автово"). Если вообще никаких гео-данных нет - пиши "НЕ УКАЗАН".
4. budget: Зарплата (или 'По договоренности').
5. isSpam: true, ТОЛЬКО ЕСЛИ это реклама чужого канала/бота, казино, ставки, или спам. Реальная работа = false.
6. score: 90 если есть контакты, иначе 70.`
                },
                {
                  role: 'user',
                  content: rawText
                }
              ]
            })
          });

          if (!response.ok) {
             const errText = await response.text();
             console.error(`API Error ${response.status}: ${errText}`);
             throw new Error(`API returned ${response.status}: ${errText.substring(0, 50)}...`);
          }

          const data = await response.json();
          let content = data.choices[0].message.content;
          
          if (content.includes('```json')) {
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
          }
          
          const result = JSON.parse(content);
          
          return {
            title: result.title || 'Новый заказ',
            category: result.category || 'other',
            city: result.city || 'НЕ УКАЗАН',
            budget: result.budget || 'По договоренности',
            score: result.score || 70,
            isSpam: result.isSpam || false,
            cleanedText: cleanRawText(rawText) // Не тратим токены ИИ на очистку, чистим скриптом
          };
        } catch (error) {
          attempts++;
          console.error(`DeepSeek API Attempt ${attempts} failed:`, error);
          if (attempts < maxAttempts) {
             await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      console.warn('DeepSeek attempts exhausted. Falling back to script parser.');
      return fallbackScriptParse(rawText, dbCategories);
    } catch (error: any) {
      console.error('AI Pipeline Fatal Error:', error);
      throw new Error(`AI Pipeline Error: ${error.message || 'Unknown'}`);
    }
  }
};

