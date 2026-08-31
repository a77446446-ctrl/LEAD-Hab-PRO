import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    s = f.read()

s = s.replace('deletedAt     DateTime?     @index', 'deletedAt     DateTime?')
s = s.replace('deletedAt    DateTime? @index', 'deletedAt    DateTime?')

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(s)
