import 'server-only';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { kopecksToRubles } from '@/lib/money';
import { sessionCookie, verifySessionToken } from '@/lib/auth/session';
import { isConfiguredAdminMaxId } from '@/lib/auth/admin-config';

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export async function getCurrentUser() {
  const token = cookies().get(sessionCookie.name)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      maxId: true,
      name: true,
      role: true,
      balanceKopecks: true,
      rating: true,
      notifyEnabled: true,
      botStartedAt: true,
      createdAt: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError('Требуется авторизация через MAX');
  return user;
}

export async function requireAdmin() {
  const user = await requireCurrentUser();
  if (!isConfiguredAdminMaxId(user.maxId)) throw new AuthorizationError('Недостаточно прав');
  return user;
}

export function serializeCurrentUser(user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  return {
    id: user.id,
    max_id: user.maxId.toString(),
    name: user.name,
    role: isConfiguredAdminMaxId(user.maxId) ? 'admin' : 'user',
    balance: kopecksToRubles(user.balanceKopecks),
    rating: user.rating,
    notify_enabled: user.notifyEnabled,
    bot_available: Boolean(user.botStartedAt),
    created_at: user.createdAt.toISOString(),
  };
}
