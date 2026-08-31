import re
with open('src/app/api/admin/parser/sync/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Add import
if 'reconcilePayments' not in c:
    c = c.replace(
        "import { maxParser } from '@/services/max-parser';",
        "import { maxParser } from '@/services/max-parser';\nimport { reconcilePayments } from '@/services/yookassa';"
    )
    
    # Call it before maxParser.sync()
    c = c.replace(
        "const result = await maxParser.sync();",
        "// Background YooKassa reconciliation\n    try {\n      const reconciled = await reconcilePayments();\n      if (reconciled > 0) console.log(Reconciled  payments.);\n    } catch(e) { console.error('Reconciliation error:', e); }\n\n    const result = await maxParser.sync();"
    )

with open('src/app/api/admin/parser/sync/route.ts', 'w', encoding='utf-8') as f:
    f.write(c)
