/** Очистка представления: исходные условия и рекламный текст остаются дословными. */
const CONTACT_FOOTER = /^Контакты\s*\(ссылки\):/iu;
const NUMBER = String.raw`\d{1,7}(?:[.,]\d+)?(?:\s*[кkмm](?!\p{L}))?`;
const CLOCK = /^(?:(?:сегодня|вчера)\s*(?:в\s*)?)?(?:[01]?\d|2[0-3]):[0-5]\d/iu;
const COUNTER_PREFIX = new RegExp(`^${NUMBER}(?![\\d:])`, 'iu');
const LABEL = String.raw`(?:комментари[а-я]*|просмотр[а-я]*|реакци[а-я]*|пересыл[а-я]*)`;
// Только значки интерфейса. Мешочек с суммой и часы начала смены — данные объявления.
const EXPLICIT = new RegExp(`^(?:${LABEL}|(?:👁|👀|💬|🗨)[\\uFE0F\\u200D]*|(?:👍|👎|❤|🔥|👏|🙏|😁|🤔|🤩|🎉|💯)[\\uFE0F\\u200D\\p{Emoji_Modifier}]*(?=\\s*\\d))`, 'iu');
const FOOTER_LABEL = /^(?:вакансии|оставить комментарий|написать комментарий)$/iu;
const VALUE_LABEL = /(?:оплат\p{L}*|зарплат\p{L}*|оклад|ставк\p{L}*|бюджет|сумм\p{L}*|телефон|контакт|адрес|дом|кв\.?|корпус|начало|окончание|смен\p{L}*|график|время|человек|количество|нужно|требуется)\s*[:—–-]?$/iu;

function metadata(line: string): { candidate: boolean; explicit: boolean; clock: boolean; counter: boolean } {
  let rest = line.replace(/[\u200b-\u200f\u2060\ufeff]/g, '').trim();
  let explicit = false;
  let clock = false;
  let atoms = 0;
  let counter = false;
  if (FOOTER_LABEL.test(rest)) return { candidate: true, explicit: false, clock: false, counter: false };
  while (rest) {
    const time = rest.match(CLOCK);
    const known = time ? null : rest.match(EXPLICIT);
    const count = time || known ? null : rest.match(COUNTER_PREFIX);
    const token = time || known || count;
    if (!token) return { candidate: false, explicit: false, clock: false, counter: false };
    clock ||= Boolean(time);
    explicit ||= Boolean(known);
    counter ||= Boolean(count);
    atoms++;
    rest = rest.slice(token[0].length).replace(/^[\s|·•,;:]+/u, '');
  }
  return { candidate: atoms > 0, explicit, clock, counter };
}

function cleanBlock(lines: string[]): string[] {
  let end = lines.length;
  while (end && !lines[end - 1].trim()) end--;
  let start = end;
  while (start && (!lines[start - 1].trim() || metadata(lines[start - 1].trim()).candidate)) start--;
  const tail = lines.slice(start, end).filter((line) => line.trim()).map((line) => metadata(line.trim()));
  // Одинокое число или время неоднозначно: удаляем только подтверждённый хвост интерфейса.
  if (!tail.some((item) => item.explicit) && !(tail.some((item) => item.counter) && tail.some((item) => item.clock))) return lines.slice(0, end);
  if (start > 0 && VALUE_LABEL.test(lines[start - 1].trim())) {
    // Значение после «Оплата:» или «Начало смены:» сохраняем, даже перед счётчиками.
    while (start < end && !metadata(lines[start].trim()).explicit) start++;
  } else {
    // Не принимаем одиночную сумму или время перед явными счётчиками за часть интерфейса.
    const firstExplicit = lines.findIndex((line, index) => index >= start && metadata(line.trim()).explicit);
    if (firstExplicit > start) {
      const prefix = lines.slice(start, firstExplicit).map((line) => metadata(line.trim()));
      if (!prefix.some((item) => item.clock) || !prefix.some((item) => item.counter)) {
        while (start < firstExplicit && !FOOTER_LABEL.test(lines[start].trim())) start++;
      }
    }
  }
  return lines.slice(0, start);
}

export function cleanLeadText(value: string): string {
  const lines = String(value || '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '').split('\n');
  const output: string[] = [];
  let block: string[] = [];
  for (const line of lines) {
    if (CONTACT_FOOTER.test(line.trim())) {
      output.push(...cleanBlock(block), line);
      block = [];
    } else {
      block.push(line);
    }
  }
  output.push(...cleanBlock(block));
  return output.join('\n').trim();
}
