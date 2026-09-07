const CONTACT_FOOTER = /^Контакты\s*\(ссылки\):/iu;
const TIME = /^(?:[01]?\d|2[0-3]):[0-5]\d$/u;
const COUNTER = /^\d{1,7}(?:[.,]\d+)?\s*(?:[kкmм]|\s*комментари[а-я]*|\s*просмотр[а-я]*)?$/iu;
const VALUE_LABEL = /(?:оплат\p{L}*|зарплат\p{L}*|оклад|ставк\p{L}*|бюджет|сумм\p{L}*|телефон|контакт|адрес|дом|кв\.?|корпус|начало|окончание|смен\p{L}*|график|время)\s*[:—–-]?$/iu;
const PROMO_FOOTER = /^(?:подборка вакансий в классных компаниях|больше вакансий|все вакансии тут|подписывайтесь на (?:наш )?канал)[.!\s]*$/iu;

/** Удаляет хвост интерфейса, сохраняя числа и время внутри объявления. */
function cleanBlock(lines: string[]): string[] {
  const result = lines.filter((line) => !PROMO_FOOTER.test(line));
  while (result.length && !result.at(-1)) result.pop();
  
  if (result.length === 0) return result;

  let end = result.length - 1;
  // If the last line is TIME, we definitely want to check the block.
  // If the last line is COUNTER, we also want to check the block.
  if (!TIME.test(result[end]) && !COUNTER.test(result[end])) {
    return result;
  }

  let start = end;
  // Move start backwards as long as we see TIME or COUNTER
  while (start > 0 && (TIME.test(result[start - 1]) || COUNTER.test(result[start - 1]))) {
    start--;
  }

  let label = start - 1;
  while (label >= 0 && !result[label]) label--;
  // «Начало смены: / 09:15» и «Оплата: / 4500» — данные объявления, не счётчики.
  if (label >= 0 && VALUE_LABEL.test(result[label])) return result;
  
  result.splice(start, end - start + 1);
  while (result.length && !result.at(-1)) result.pop();
  return result;
}

/** Общая очистка для сохранения и показа старых карточек в обоих режимах. */
export function cleanLeadText(value: string): string {
  const lines = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/🚇/g, 'М')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\ufeff]/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t\u00a0 ]+/g, ' ').trim());
  const output: string[] = [];
  let block: string[] = [];
  for (const line of lines) {
    if (CONTACT_FOOTER.test(line)) {
      output.push(...cleanBlock(block), line);
      block = [];
    } else {
      block.push(line);
    }
  }
  output.push(...cleanBlock(block));
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Точное содержимое, без нечёткого сравнения профессий, адресов или телефонов. */
export function leadContentKey(lead: { rawText: string; phone?: string | null }): string {
  const text = cleanLeadText(lead.rawText).normalize('NFC').replace(/\s+/g, ' ').trim();
  const phone = (lead.phone || '').replace(/[^\d+]/g, '');
  return JSON.stringify([text, phone]);
}

/** Старые записи остаются в БД вместе с покупками; в списке показываем одну копию. */
export function uniqueLeadCards<T extends { rawText: string; phone?: string | null }>(leads: T[]): T[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    if (!cleanLeadText(lead.rawText)) return true;
    const key = leadContentKey(lead);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
