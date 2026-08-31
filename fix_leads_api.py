import re

with open('src/app/api/leads/route.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'const where: Prisma.LeadWhereInput = {};',
    'const where: Prisma.LeadWhereInput = { deletedAt: null };'
)

with open('src/app/api/leads/route.ts', 'w', encoding='utf-8') as f:
    f.write(c)
