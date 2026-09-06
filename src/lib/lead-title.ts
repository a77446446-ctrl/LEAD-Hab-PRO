const INTENT_PATTERN = /(^|[^\p{L}\p{N}])(требу(?:ется|ются)|ищем|нуж(?:ен|на|ны|но)|вакансия|заказ|приглашаем)(?=$|[^\p{L}\p{N}])/iu;
const MAX_TITLE_WORDS = 10;
const MAX_TITLE_LENGTH = 100;

function cleanCandidate(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|•·✅☑️🔹🔸📌📣🔥]+/u, '')
    .replace(/[\s,;:—–-]+$/g, '')
    .trim();
}

function titleFromSource(sourceText: string): string {
  const lines = sourceText
    .split(/\r?\n+/)
    .map(cleanCandidate)
    .filter((line) => line.length >= 4);
  if (lines.length === 0) return '';

  const intentLine = lines.find((line) => INTENT_PATTERN.test(line));
  let candidate = intentLine || lines[0];
  const intent = candidate.match(INTENT_PATTERN);
  if (intent?.index !== undefined) {
    candidate = candidate.slice(intent.index + intent[1].length);
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
    || ['новый заказ', 'новое сообщение', 'без названия'].includes(suggested.toLowerCase());
  const candidate = suggestedIsBroken ? titleFromSource(sourceText) : suggested;
  return limitByWords(candidate || titleFromSource(sourceText));
}
