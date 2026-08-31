import re

with open('src/app/api/admin/parser/sync/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

if 'export const maxDuration' not in c:
    c = c.replace(
        "export async function POST() {",
        "export const maxDuration = 300; // 5 minutes timeout\n\nexport async function POST() {"
    )
    with open('src/app/api/admin/parser/sync/route.ts', 'w', encoding='utf-8') as f:
        f.write(c)
