import re

with open('src/app/api/admin/system/cleanup/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

new_imports = '''import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/current-user';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // 5 minutes timeout
'''

c = c.replace(
    "import { NextResponse } from 'next/server';\nimport { prisma } from '@/lib/prisma';\nimport { requireAdmin } from '@/lib/auth/current-user';",
    new_imports
)

file_cleanup_code = '''
    // 5. Cleanup debug_screenshots folder
    let deletedFiles = 0;
    try {
      const debugDir = path.join(process.cwd(), 'debug_screenshots');
      if (fs.existsSync(debugDir)) {
        const files = fs.readdirSync(debugDir);
        const now = Date.now();
        const MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days
        for (const file of files) {
          if (!file.endsWith('.png') && !file.endsWith('.jpg') && !file.endsWith('.log')) continue;
          const filePath = path.join(debugDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > MAX_AGE) {
            fs.unlinkSync(filePath);
            deletedFiles++;
          }
        }
      }
    } catch (e) {
      console.error('Failed to cleanup debug files:', e);
    }
'''

c = c.replace(
    'return NextResponse.json({',
    file_cleanup_code + '\n    return NextResponse.json({'
)

c = c.replace(
    'scrubbed: scrubbedLeads.count,',
    'scrubbed: scrubbedLeads.count,\n      deletedDebugFiles: deletedFiles,'
)

with open('src/app/api/admin/system/cleanup/route.ts', 'w', encoding='utf-8') as f:
    f.write(c)
