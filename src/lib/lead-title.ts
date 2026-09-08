import { cleanLeadText } from './lead-content.ts';

const INTENT_PATTERN = /(?<!не\s)(?:требу(?:ется|ются)|ищем|нуж(?:ен|на|ны|но)|вакансия|заказ|приглашаем)/iu;
const MAX_TITLE_WORDS = 10;
const MAX_TITLE_LENGTH = 100;

function isGenericTitle(value: string): boolean {
  return /^(?:требу(?:ется|ются)|ищем|нуж(?:ен|на|ны|но)|вакансия|работа|новый заказ|новое сообщение|без названия|спам\s*\/\s*реклама\s*\/\s*резюме)[!:.\s]*$/iu.test(value);
}

function cleanCandidate(value: string): string {
  let cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|•·—–✅☑️🔹🔸📌📣🔥❌❗️!-]+/u, '')
    .replace(/[\s,;:—–-]+$/g, '')
    .trim();

  // Удаляем мусорные префиксы
  const stopPrefixes = /^(?:москва|спб|питер|мск|заявка закрыта|стоп|срочно|внимание|работа|подработка|халтура|шабашка|сегодня|завтра|послезавтра|смена|[\d.,:\s]+руб|[\d.,:\s]+р\/ч|на завтра|на сегодня)[!:\s\-|•·—–✅☑️🔹🔸📌📣🔥❌❗️]+/iu;
  let prev = '';
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(stopPrefixes, '').trim();
    cleaned = cleaned.replace(/^[\s|•·—–✅☑️🔹🔸📌📣🔥❌❗️!-]+/u, '').trim();
  }
  
  return cleaned;
}

function titleFromSource(sourceText: string): string {
  const lines = cleanLeadText(sourceText)
    .split(/\r?\n+/)
    .map(cleanCandidate)
    .filter((line) => line.length >= 4 && !/^(?:заявка закрыта|стоп|не актуально|удалено)/iu.test(line) && !/^(?:ст\.|метро|м\.|г\.|город|ул\.|улица|адрес|район)\s/iu.test(line));
  if (lines.length === 0) return '';

  // Сначала ищем явные маркеры задач
  const taskMarker = /^(?:задача|что делать|нужно|требуется|ищем|нужны|обязанности|требуются)[\s:-]+/iu;
  const taskIndex = lines.findIndex((line) => taskMarker.test(line));
  if (taskIndex >= 0) {
    const candidate = lines[taskIndex].replace(taskMarker, '').trim();
    if (candidate.length >= 4) return cleanCandidate(candidate.split(/(?<=[!?])\s|\s[|•]\s|[,;]/)[0]);
    if (lines.length > taskIndex + 1) return cleanCandidate(lines[taskIndex + 1].split(/(?<=[!?])\s|\s[|•]\s|[,;]/)[0]);
  }

  // Если нет маркера, ищем содержательное требование
  const intentIndex = lines.findIndex((line) => INTENT_PATTERN.test(line) && !isGenericTitle(line));
  let candidate = intentIndex >= 0 ? lines[intentIndex] : lines[0];
  if (intentIndex >= 0 && lines.length > intentIndex + 1) {
    const nextLine = lines[intentIndex + 1];
    if (nextLine && !/^(?:оплата|график|телефон|контакт|условия|требования|обязанности|адрес)/iu.test(nextLine)) {
      candidate = `${candidate} ${nextLine}`;
    }
  }

  if (intentIndex < 0 && taskIndex < 0) {
    const heading = lines.findIndex((line) => isGenericTitle(line) && INTENT_PATTERN.test(line));
    if (heading >= 0) {
      const details = lines.slice(heading + 1, heading + 3)
        .filter((line) => !/^(?:оплата|график|телефон|контакт|это удобно|адрес)/iu.test(line))
        .map((line) => cleanCandidate(line.split(/[,;]|\s[—–]\s/)[0]));
      if (details.length) candidate = `${lines[heading]} ${details.join(' и ')}`;
    }
  }

  const intent = candidate.match(INTENT_PATTERN);
  if (intent?.index !== undefined) {
    candidate = candidate.slice(intent.index);
  }
  
  // Если после всего остался адрес - берем следующую строку
  if (/^адрес[\s:-]/iu.test(candidate) && lines.length > 1) {
      candidate = lines[1];
  }

  return cleanCandidate(candidate.split(/(?<=[!?])\s|\s[|•]\s/)[0] || candidate);
}


function limitByWords(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  let result = words.slice(0, MAX_TITLE_WORDS).join(' ');
  while (result.length > MAX_TITLE_LENGTH && result.includes(' ')) {
    result = result.slice(0, result.lastIndexOf(' '));
  }
  return result || 'Новый заказ';
}

export function buildLeadTitle(sourceText: string, suggestedTitle?: unknown): string {
  const suggested = typeof suggestedTitle === 'string' ? cleanCandidate(suggestedTitle) : '';
  const suggestedIsBroken = !suggested
    || /(?:\.{3}|…)$/.test(suggested)
    || isGenericTitle(suggested);
  const candidate = suggestedIsBroken ? titleFromSource(sourceText) : suggested;
  return limitByWords(candidate || titleFromSource(sourceText));
}
