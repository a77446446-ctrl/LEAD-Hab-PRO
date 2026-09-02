import { adminGuard } from '@/lib/auth/admin-guard';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalExt = file.name.split('.').pop() || 'png';
    const filename = `image-${uniqueSuffix}.${originalExt}`;
    
    // Save to data/uploads to persist across restarts and be served by our dynamic route
    const dir = join(process.cwd(), 'data', 'uploads');
    await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }).catch(() => {}));
    
    const path = join(dir, filename);
    await writeFile(path, buffer);

    return NextResponse.json({ url: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
