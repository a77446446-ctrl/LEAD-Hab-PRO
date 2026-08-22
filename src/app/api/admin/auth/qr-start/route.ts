export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { proxy } = await req.json();
    const scriptPath = path.join(process.cwd(), 'scripts/auth_manager.py');
    
    console.log(`MAKS Auth: Starting QR script at ${scriptPath} with proxy: ${proxy || 'None'}`);
    
    // Using exec to run start cmd /k ensures a visible window opens on Windows
    // /k keeps the terminal open so the user can see any potential python errors
    exec(`start "MAKS Auth QR" cmd /k python "${scriptPath}" None "${proxy || ''}"`);

    console.log('MAKS Auth: QR script launched via exec');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('MAKS Auth: Failed to start QR script:', error);
    return NextResponse.json({ success: false, error: 'Failed to start script' }, { status: 500 });
  }
}
