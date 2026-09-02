import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request, { params }: { params: { filename: string } }) {
  try {
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
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('File not found', { status: 404 });
  }
}
