import os

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    s = f.read()
if 'fingerprint' not in s:
    s = s.replace('sourceChat    String?', 'sourceChat    String?\n  fingerprint   String?       @unique')
    with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
        f.write(s)

with open('src/services/max-parser.ts', 'r', encoding='utf-8') as f:
    p = f.read()
if 'fingerprint' not in p:
    old = '''    const stableText = String(processed.cleanedText || cleaned).trim().slice(0, 1500);
    const duplicate = await withDbRetry(() => prisma.lead.findFirst({
      where: { rawText: stableText, sourceChat: chatUrl },
      select: { id: true },
    }));
    if (duplicate) return false;

    await withDbRetry(() => createLeadWithDeliveries({
      title: String(processed.title || '????? ?????????').slice(0, 200),
      rawText: stableText,
      city: String(processed.city || '?? ??????').slice(0, 100),
      categoryId: category.id,
      sourceChat: chatUrl,
      score: parseAll ? 100 : Math.min(100, Math.max(0, processed.score || 50)),'''

    new_str = '''    const stableText = String(processed.cleanedText || cleaned).trim().slice(0, 1500);

    const crypto = await import('crypto');
    const fingerprint = crypto.createHash('sha256').update(stableText.toLowerCase()).digest('hex');

    const duplicate = await withDbRetry(() => prisma.lead.findFirst({
      where: { OR: [{ fingerprint }, { rawText: stableText, sourceChat: chatUrl }] },
      select: { id: true },
    }));
    if (duplicate) return false;

    await withDbRetry(() => createLeadWithDeliveries({
      title: String(processed.title || '????? ?????????').slice(0, 200),
      rawText: stableText,
      city: String(processed.city || '?? ??????').slice(0, 100),
      categoryId: category.id,
      sourceChat: chatUrl,
      fingerprint,
      score: parseAll ? 100 : Math.min(100, Math.max(0, processed.score || 50)),'''

    p = p.replace(old, new_str)
    with open('src/services/max-parser.ts', 'w', encoding='utf-8') as f:
        f.write(p)
print('Restored point 6')
