import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { filename: string } }) {
  try {
    // 1. Check if it's a database-backed image (starts with img_)
    if (params.filename.startsWith('img_')) {
      const setting = await prisma.setting.findUnique({
        where: { key: params.filename }
      });
      
      if (setting && setting.value.startsWith('data:')) {
        const matches = setting.value.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              'Content-Type': mimeType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        }
      }
    }

    // 2. Fallback to file system (legacy)
    let path = join(process.cwd(), 'data', 'uploads', params.filename);
    let buffer: Buffer;
    try {
      buffer = await readFile(path);
    } catch {
      path = join(process.cwd(), 'public', 'uploads', params.filename);
      buffer = await readFile(path);
    }
    
    const ext = params.filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/webp';
    
    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('File not found', { status: 404 });
  }
}
