export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { proxy } = await req.json();
    if (!proxy) return NextResponse.json({ valid: true });

    // We check proxy by trying to reach a public URL via python/playwright or a simple fetch
    // But since Playwright handles the complex auth, we should ideally use a small script
    // For now, let's use a simple fetch if it's a standard HTTP proxy
    // Or we can just spawn a quick check script
    
    return new Promise<NextResponse>((resolve) => {
      const scriptPath = path.join(process.cwd(), 'scripts/proxy_check.py');
      const { exec } = require('child_process');
      
      const child = exec(`python "${scriptPath}" "${proxy}"`, (error: any, stdout: string, stderr: string) => {
        const output = stdout + stderr;
        if (error) {
          resolve(NextResponse.json({ valid: false, error: output.trim() || 'Connection failed' }));
        } else {
          resolve(NextResponse.json({ valid: true }));
        }
      });
    });

  } catch (error) {
    return NextResponse.json({ valid: false, error: 'Internal error' }, { status: 500 });
  }
}
