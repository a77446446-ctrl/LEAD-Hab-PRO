const UNKNOWN = /^(?:не\s*указан[ао]?|неизвест[а-я]*|нет|—|-|адрес в тексте|уточняется|уточняйте.*)$/iu;
const PREFIX = /^(?:адрес(?:\s+работы|\s+объекта)?|место работы|локация)\s*:\s*/iu;
const STREET = /(?<!\p{L})(?:ул\.|улица|улице|улицы|проспект|пр-т|просп\.|переулок|пер\.|шоссе|бульвар|б-р|набережная|наб\.|площадь|пл\.|проезд|аллея|тупик|микрорайон|мкр\.?)(?!\p{L})/iu;

function plainLine(value: string): string {
  return value.replace(/^[\s📍📌🗺\uFE0F]+/u, '').trim();
}

/** Распознаём только написанный адрес; географию и номер дома не додумываем. */
export function isLeadAddressLine(value: string): boolean {
  const line = plainLine(value);
  const address = line.replace(PREFIX, '').trim();
  if (!address || UNKNOWN.test(address)) return false;
  return PREFIX.test(line) || (STREET.test(line) && /\d/u.test(line));
}

/** Адрес повторяется дословно; при его отсутствии показываем только известный город. */
export function leadLocationLabel(rawText: string, city?: string | null): string | null {
  const lines = String(rawText || '').split(/\r?\n/).map(plainLine);
  const addresses = lines.filter(isLeadAddressLine).map((line) => line.replace(PREFIX, '').trim());
  if (addresses.length) return Array.from(new Set(addresses)).join('\n');
  const knownCity = city?.trim();
  return knownCity && !UNKNOWN.test(knownCity) ? knownCity : null;
}
