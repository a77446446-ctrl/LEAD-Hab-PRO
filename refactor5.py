import codecs, re, glob

for path in glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    with codecs.open(path, 'r', 'utf-8') as f:
        c = f.read()
    orig = c
    
    # Remove float properties in prisma writes
    lines = c.split('\n')
    new_lines = []
    for line in lines:
        if re.search(r'\b(balance|price|amount)\s*:\s*(\{.*?Number.*?/.*?100.*?\}|Number.*?/.*?100|kopecksToRubles)', line):
            if 'export' not in line and 'return' not in line and 'newBalance' not in line:
                continue
        new_lines.append(line)
    c = '\n'.join(new_lines)
    
    c = c.replace('balanceKopecks', 'balance')
    c = c.replace('amountKopecks', 'amount')
    c = c.replace('priceKopecks', 'price')
    
    # Fix BigInts for ONBOARDING_BONUS
    c = c.replace('function getOnboardingBonus(): bigint', 'function getOnboardingBonus(): number')
    c = c.replace('BigInt(raw)', 'Math.round(Number(raw))')
    c = c.replace('100_000_000n', '100_000_000')
    c = c.replace('0n', '0')
    
    # Fix BigInts in buy-lead
    if 'buy-lead' in path:
        c = re.sub(r'BigInt\(Math\.round\(([^)]+)\)\)', r'Math.round(\1)', c)
        c = re.sub(r'BigInt\(([^)]+)\)', r'Number(\1)', c)

    # UI updates (balance / 100)
    if path.endswith('.tsx') or 'components' in path or 'app/(admin)' in path or 'app/(dashboard)' in path:
        c = re.sub(r'user\.balance(?!Kopecks|:| /)', r'(user.balance / 100)', c)
        c = re.sub(r'lead\.price(?!Kopecks|:| /)', r'(lead.price / 100)', c)
        c = re.sub(r'category\.leadPrice(?!:| /)', r'(category.leadPrice / 100)', c)
        c = re.sub(r'category\.subscriptionPrice(?!:| /)', r'(category.subscriptionPrice / 100)', c)

    # yookassa
    if 'yookassa' in path:
        c = c.replace('let amount: bigint', 'let amount: number')
        c = c.replace('function amountValue(kopecks: bigint)', 'function amountValue(kopecks: number)')

    # webhooks/max/route.ts
    if 'webhooks' in path:
        c = c.replace('parsed.amount * 100))', 'parsed.amount * 100))')

    if orig != c:
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(c)
print('Refactored safe 5')
