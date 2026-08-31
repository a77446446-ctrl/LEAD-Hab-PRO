const MAX_SAFE_KOPECKS = Number.MAX_SAFE_INTEGER;

export function rublesToKopecks(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Некорректная сумма');
  const kopecks = Math.round(value * 100);
  if (kopecks > MAX_SAFE_KOPECKS) throw new Error('Сумма превышает лимит');
  return kopecks;
}

export function kopecksToRubles(value: number): number {
  if (value > MAX_SAFE_KOPECKS || value < -MAX_SAFE_KOPECKS) throw new Error('Сумма превышает лимит');
  return value / 100;
}
