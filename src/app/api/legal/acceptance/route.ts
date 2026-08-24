import { NextResponse } from 'next/server';
import { AuthenticationError, requireCurrentUser } from '@/lib/auth/current-user';
import { getLegalAcceptance, getLegalConfig, legalDocumentHash, LEGAL_DOCUMENT_TYPES } from '@/lib/legal';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const acceptance = await getLegalAcceptance(user.id);
    return NextResponse.json({ ...acceptance, documents: ['/legal/offer', '/legal/privacy', '/legal/consent'] });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: 'Не удалось проверить согласие' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = await request.json() as { acceptedDocuments?: unknown; version?: unknown };
    const { version } = getLegalConfig();
    const acceptedDocuments = Array.isArray(body.acceptedDocuments)
      ? new Set(body.acceptedDocuments.filter((item): item is string => typeof item === 'string'))
      : new Set<string>();
    if (body.version !== version || !LEGAL_DOCUMENT_TYPES.every((type) => acceptedDocuments.has(type))) {
      return NextResponse.json({ error: 'Необходимо принять актуальные версии документов' }, { status: 400 });
    }
    await prisma.$transaction(LEGAL_DOCUMENT_TYPES.map((documentType) => prisma.legalAcceptance.upsert({
      where: { userId_documentType_version: { userId: user.id, documentType, version } },
      update: { documentHash: legalDocumentHash(documentType), source: 'MINI_APP', acceptedAt: new Date() },
      create: { userId: user.id, documentType, version, documentHash: legalDocumentHash(documentType), source: 'MINI_APP' },
    })));
    return NextResponse.json(await getLegalAcceptance(user.id));
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: 'Не удалось сохранить согласие' }, { status: 500 });
  }
}
