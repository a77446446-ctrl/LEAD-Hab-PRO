/** Очистка представления: исходные условия и рекламный текст остаются дословными. */
const CONTACT_FOOTER = /^Контакты\s*\(ссылки\):/iu;
const DECORATION = /^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u;
const CLOCK = /^(?:(?:сегодня|вчера)\s*(?:в\s*)?)?(?:[01]?\d|2[0-3]):[0-5]\d$/iu;
const COUNTER = /^\d{1,7}(?:[.,]\d+)?\s*[кkмm]?$/iu;
const LABEL = /^(?:\d+[.,]?\d*\s*[кkмm]?\s*)?(?:комментари[а-я]*|просмотр[а-я]*|реакци[а-я]*|пересыл[а-я]*)(?:\s*[:·—–-]?\s*\d+[.,]?\d*\s*[кkмm]?)?$/iu;
const VALUE_LABEL = /(?:оплат\p{L}*|зарплат\p{L}*|оклад|ставк\p{L}*|бюджет|сумм\p{L}*|телефон|контакт|адрес|дом|кв\.?|корпус|начало|окончание|смен\p{L}*|график|время|человек|количество|нужно|требуется)\s*[:—–-]?$/iu;

function metadata(line: string): { candidate: boolean; explicit: boolean; clock: boolean } {
  const text = line.replace(DECORATION, '').trim();
  const clock = CLOCK.test(text);
  const decoratedCounter = COUNTER.test(text) && /\p{Extended_Pictographic}/u.test(line);
  const reaction = /^(?:\p{Extended_Pictographic}[\uFE0F\u200D\p{Emoji_Modifier}\p{Extended_Pictographic}]*\s*\d+\s*)+$/u.test(line);
  const explicit = LABEL.test(text) || decoratedCounter || reaction;
  return { candidate: explicit || clock || COUNTER.test(text), explicit, clock };
}

function cleanBlock(lines: string[]): string[] {
  let end = lines.length;
  while (end && !lines[end - 1].trim()) end--;
  let start = end;
  while (start && (!lines[start - 1].trim() || metadata(lines[start - 1].trim()).candidate)) start--;
  const tail = lines.slice(start, end).filter((line) => line.trim()).map((line) => metadata(line.trim()));
  // Одинокое число или время неоднозначно: удаляем только подтверждённый хвост интерфейса.
  if (!tail.some((item) => item.explicit) && !(tail.length > 1 && tail.some((item) => item.clock))) return lines.slice(0, end);
  if (start > 0 && VALUE_LABEL.test(lines[start - 1].trim())) {
    // Значение после «Оплата:» или «Начало смены:» сохраняем, даже перед счётчиками.
    while (start < end && !metadata(lines[start].trim()).explicit) start++;
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
