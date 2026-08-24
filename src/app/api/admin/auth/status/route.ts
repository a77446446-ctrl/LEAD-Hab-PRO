import { adminGuard } from '@/lib/auth/admin-guard';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const sessionPath = path.join(process.cwd(), 'sessions/active_session.json');
    
    try {
      const stats = await fs.stat(sessionPath);
      const data = JSON.parse(await fs.readFile(sessionPath, 'utf8'));
      
      // Try to find user info in localStorage entries
      let name = 'Пользователь МАКС';
      if (data.origins) {
        for (const origin of data.origins) {
          const userEntry = origin.localStorage.find((e: any) => e.name === 'user' || e.name.includes('profile'));
          if (userEntry) {
            try {
              const userData = JSON.parse(userEntry.value);
              name = userData.name || userData.first_name || name;
            } catch (e) {}
          }
        }
      }

      return NextResponse.json({ 
        active: true, 
        name,
        updatedAt: stats.mtime 
      });
    } catch (e) {
      return NextResponse.json({ active: false });
    }
  } catch (error) {
    return NextResponse.json({ active: false }, { status: 500 });
  }
}
