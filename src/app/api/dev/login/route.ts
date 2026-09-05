import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { sessionCookie, createSessionToken } from '@/lib/auth/session';

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_LOGIN_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Generate a fake admin session without hitting the database
  const token = await createSessionToken('fake-admin-id', 'ADMIN');

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set({
    name: sessionCookie.name,
    value: token,
    ...sessionCookie.options,
    maxAge: sessionCookie.maxAge,
  });

  // Redirect to admin panel
  return NextResponse.redirect(new URL('/admin', 'http://localhost:3000'));
}
