const CONTACT_PATTERN = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@[a-zA-Z0-9_]+|(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b)/gi;

export function redactContactInfo(value: string, preserveType: boolean = false): string {
  return value.replace(CONTACT_PATTERN, (match) => {
    // Map links should always remain visible
    if (/(yandex\.(ru|com)\/maps|maps\.yandex\.(ru|com)|2gis\.(ru|com)|go\.2gis\.com|maps\.google|goo\.gl\/maps)/i.test(match)) {
      return match;
    }
    
    if (!preserveType) return '[контакт скрыт]';
    
    if (match.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|@[a-zA-Z0-9_]+)/)) return '[контакт скрыт:link]';
    if (match.match(/(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b/)) return '[контакт скрыт:phone]';
    return '[контакт скрыт:link]';
  });
}
export function extractContactInfo(value: string): string[] {
  const matches = value.match(CONTACT_PATTERN) || [];
  return Array.from(new Set(matches.map((match) => match.trim()).filter(Boolean))).slice(0, 20);
}