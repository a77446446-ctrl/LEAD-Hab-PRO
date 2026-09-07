import { cleanLeadText } from './lead-content.ts';

const INTENT_PATTERN = /(^|[^\p{L}\p{N}])(требу(?:ется|ются)|ищем|нуж(?:ен|на|ны|но)|вакансия|заказ|приглашаем)(?=$|[^\p{L}\p{N}])/iu;
const MAX_TITLE_WORDS = 10;
const MAX_TITLE_LENGTH = 100;

function cleanCandidate(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|•·—–✅☑️🔹🔸📌📣🔥-]+/u, '')
    .replace(/[\s,;:—–-]+$/g, '')
    .trim();
}

function titleFromSource(sourceText: string): string {
  const lines = cleanLeadText(sourceText)
    .split(/\r?\n+/)
    .map(cleanCandidate)
    .filter((line) => line.length >= 4);
  if (lines.length === 0) return '';

  // Сначала содержательное требование, а не отдельная строка «Требуется:».
  const intentIndex = lines.findIndex((line) => INTENT_PATTERN.test(line) && !isGenericTitle(line));
  let candidate = intentIndex >= 0 ? lines[intentIndex] : lines[0];
  if (intentIndex >= 0 && lines.length > intentIndex + 1) {
    // Join with next line if it doesn't look like a new section (e.g. no colon, no uppercase start unless it's short)
    const nextLine = lines[intentIndex + 1];
    if (nextLine && !/^(?:оплата|график|телефон|контакт|условия|требования|обязанности)/iu.test(nextLine)) {
      candidate = `${candidate} ${nextLine}`;
    }
  }

  if (intentIndex < 0) {
    const heading = lines.findIndex((line) => isGenericTitle(line) && INTENT_PATTERN.test(line));
    if (heading >= 0) {
      const details = lines.slice(heading + 1, heading + 3)
        .filter((line) => !/^(?:оплата|график|телефон|контакт|это удобно)/iu.test(line))
        .map((line) => cleanCandidate(line.split(/[,;]|\s[—–]\s/)[0]));
      if (details.length) candidate = `${lines[heading]} ${details.join(' и ')}`;
    }
  }
  const intent = candidate.match(INTENT_PATTERN);
  if (intent?.index !== undefined) {
    candidate = candidate.slice(intent.index + intent[1].length);
  }
  return cleanCandidate(candidate.split(/(?<=[!?])\s|\s[|•]\s/)[0] || candidate);
}

function isGenericTitle(value: string): boolean {
  return /^(?:требу(?:ется|ются)|ищем|нуж(?:ен|на|ны|но)|вакансия|работа|новый заказ|новое сообщение|без названия|спам\s*\/\s*реклама\s*\/\s*резюме)[!:.\s]*$/iu.test(value);
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
