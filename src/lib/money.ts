const MAX_SAFE_KOPECKS = BigInt(Number.MAX_SAFE_INTEGER);

export function rublesToKopecks(value: number): bigint {
  if (!Number.isFinite(value) || value < 0) throw new Error('Некорректная денежная сумма');
  const kopecks = BigInt(Math.round(value * 100));
  if (kopecks > MAX_SAFE_KOPECKS) throw new Error('Денежная сумма превышает допустимый предел');
  return kopecks;
}

export function kopecksToRubles(value: bigint): number {
  if (value > MAX_SAFE_KOPECKS || value < -MAX_SAFE_KOPECKS) throw new Error('Денежная сумма превышает допустимый предел');
  return Number(value) / 100;
}
