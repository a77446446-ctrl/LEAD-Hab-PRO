import re

with open('prisma/schema.prisma', 'r', encoding='utf-8') as f:
    s = f.read()

s = re.sub(r'balance\s+Float\s+@default\(0\)\n\s+balanceKopecks\s+BigInt\s+@default\(0\)', r'balance                  Int                      @default(0)', s)
s = re.sub(r'leadPrice\s+Float\s+@default\(0\)', r'leadPrice         Int                      @default(0)', s)
s = re.sub(r'subscriptionPrice\s+Float\s+@default\(0\)', r'subscriptionPrice Int                      @default(0)', s)
s = re.sub(r'price\s+Float\s+@default\(0\)', r'price         Int           @default(0)', s)
s = re.sub(r'price\s+Float\n\s+priceKopecks\s+BigInt\s+@default\(0\)', r'price        Int      @default(0)', s)
s = re.sub(r'amount\s+Float\n\s+amountKopecks\s+BigInt\s+@default\(0\)', r'amount        Int      @default(0)', s)
s = re.sub(r'amountKopecks\s+BigInt', r'amount            Int', s)

with open('prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write(s)
print('Schema fixed')
