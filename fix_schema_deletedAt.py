import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    s = f.read()

# Add deletedAt to Lead
if 'deletedAt' not in s:
    s = s.replace('purchases     Purchase[]', 'deletedAt     DateTime?     @index\n  purchases     Purchase[]')
    
    # Add deletedAt to Purchase
    s = s.replace('price        Int      @default(0)', 'price        Int      @default(0)\n  deletedAt    DateTime? @index')
    
    # Add deletedAt to Transaction
    s = s.replace('amount        Int      @default(0)', 'amount        Int      @default(0)\n  deletedAt    DateTime? @index')
    
    with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
        f.write(s)
    print('Schema updated with deletedAt')
else:
    print('deletedAt already exists')
