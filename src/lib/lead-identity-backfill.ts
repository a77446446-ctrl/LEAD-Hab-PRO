import type { PrismaClient } from '@prisma/client';
import { buildLeadContentFingerprint, isUniqueConstraintError } from './lead-identity.ts';

/** Возобновляемая обработка старых записей. Тексты, покупки и статусы не меняются. */
export async function backfillLeadIdentities(db: Pick<PrismaClient, 'lead'>) {
  let indexed = 0;
  let duplicates = 0;
  for (;;) {
    const batch = await db.lead.findMany({
      where: { contentFingerprint: null, duplicateOfId: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
      select: { id: true, rawText: true, phone: true },
    });
    if (!batch.length) return { indexed, duplicates };
    for (const lead of batch) {
      const contentFingerprint = buildLeadContentFingerprint(lead);
      try {
        // Уникальный индекс сам выбирает единственного владельца содержимого.
        const result = await db.lead.updateMany({
          where: { id: lead.id, contentFingerprint: null, duplicateOfId: null },
          data: { contentFingerprint },
        });
        indexed += result.count;
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const canonical = await db.lead.findUnique({
          where: { contentFingerprint }, select: { id: true },
        });
        if (!canonical) throw error;
        const result = await db.lead.updateMany({
          where: { id: lead.id, contentFingerprint: null, duplicateOfId: null },
          data: { duplicateOfId: canonical.id },
        });
        duplicates += result.count;
      }
    }
  }
}
