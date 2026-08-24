const CONTACT_PATTERN = /(https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@[a-zA-Z0-9_]+|(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b)/gi;

export function redactContactInfo(value: string): string {
  return value.replace(CONTACT_PATTERN, '[контакт скрыт]');
}
export function extractContactInfo(value: string): string[] {
  const matches = value.match(CONTACT_PATTERN) || [];
  return Array.from(new Set(matches.map((match) => match.trim()).filter(Boolean))).slice(0, 20);
}