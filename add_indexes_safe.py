import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    c = f.read()

def inject_indexes(model_name, indexes_str):
    global c
    pattern = r'(model ' + model_name + r' \{[^\}]+)(\})'
    replacement = r'\1\n' + indexes_str + r'\n\2'
    c = re.sub(pattern, replacement, c)

inject_indexes('Lead', '  @@index([categoryId, status, deletedAt, createdAt])\n  @@index([createdAt])\n  @@index([deletedAt])')
inject_indexes('Purchase', '  @@index([userId, deletedAt])\n  @@index([leadId])')
inject_indexes('Transaction', '  @@index([userId, deletedAt, createdAt])')

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(c)

