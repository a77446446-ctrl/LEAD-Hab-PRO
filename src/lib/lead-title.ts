import { cleanLeadText } from './lead-display.ts';

const INTENT = /(?<![\p{L}]|не\s)(?:требуется|требуются|ищем|нужен|нужна|нужны|нужно|вакансия|приглашаем)(?!\p{L})/iu;
const GENERIC = /^(?:требуется|требуются|ищем|нужен|нужна|нужны|нужно|вакансия|работа|новый заказ|новое сообщение)[!:.\s]*$/iu;
const SERVICE = /^(?:(?:создано\s+)?заказов\s*:|зарегистрирован[а-я]*\s*:|\d+\s+подписчик|контакты?|телефон|telegram|телеграм|https?:|@|№\d|комментари[а-я]*|просмотр[а-я]*)/iu;
const DETAILS = /^(?:адрес|город|метро|м\.|г\.|ул\.|район|оплата|зарплата|график|условия|требования|обязанности|гражданство|оформление|контакты|начало смены)(?:\s|:)/iu;
const PROMOTION = /(?:подписывай|наш канал|больше (?:вакансий|объявлений)|заказ любой сложности|максимально короткие сроки)/iu;
const ROLE = /(?:сотрудник|комплектовщик|упаковщик|грузчик|курьер|водител|уборщи|кассир|продавец|электрик|сантехник|сварщик|монтажник|бригада|разнорабоч|кладовщик|повар|охранник)/iu;

function cleanCandidate(value: string): string {
  return value.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D•|—–!-]+/u, '')
    .replace(/[\s:;—–-]+$/u, '').replace(/\s+/g, ' ').trim();
}

/** Только фразы исходного объявления: сохранённый заголовок и ответ ИИ не добавляют фактов. */
export function buildLeadTitle(sourceText: string, _suggestedTitle?: unknown): string {
  void _suggestedTitle; // Параметр оставлен для совместимости вызовов; факты берём только из исходника.
  const lines = cleanLeadText(sourceText).split(/\n+/).map(cleanCandidate)
    .filter((line) => line.length >= 4 && /\p{L}/u.test(line) && !SERVICE.test(line));
  let best = '';
  let bestScore = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (DETAILS.test(line)) continue;
    const intent = line.match(INTENT);
    let candidate = intent?.index !== undefined ? line.slice(intent.index) : line;
    if (GENERIC.test(candidate)) {
      const next = lines[i + 1];
      if (!next || DETAILS.test(next) || GENERIC.test(next)) continue;
      candidate += ' ' + next;
    }
    const channelHeading = /\|/.test(line) && /работа|подработка|шабашка/iu.test(line);
    const score = PROMOTION.test(candidate) ? 0 : channelHeading ? 5 : intent ? 100 : ROLE.test(line) ? 80 : 20;
    if (score > bestScore) {
      bestScore = score;
      best = candidate.split(/\s[|•]\s|(?<=[!?])\s/u)[0];
    }
  }
  const words = cleanCandidate(best).split(/\s+/).filter(Boolean).slice(0, 10);
  while (words.join(' ').length > 100) words.pop();
  return words.join(' ') || 'Новое объявление';
}
