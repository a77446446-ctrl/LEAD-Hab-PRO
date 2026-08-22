export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
  try {
    const sessionPath = path.join(process.cwd(), 'sessions/active_session.json');
    await fs.unlink(sessionPath);
    console.log('MAKS Auth: Session deleted (Logout)');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to logout' }, { status: 500 });
  }
}
