import codecs, re, glob

for path in glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    with codecs.open(path, 'r', 'utf-8') as f:
        c = f.read()
    orig = c
    
    lines = c.split('\n')
    new_lines = []
    for line in lines:
        if re.search(r'\b(balance|price|amount)\s*:\s*(\{.*?(Number.*?/.*?100|kopecksToRubles).*?\}|Number.*?/.*?100|kopecksToRubles.*?\b)', line):
            # Also catch things like alance: kopecksToRubles(result.balance) in return values?
            # No! We only want to remove it in Prisma writes where both exist!
            # If it's a return value, we WANT to keep it if we still return rubles, 
            # or better yet, return kopecks and fix UI. Let's return kopecks and fix UI.
            pass
    
    # We want to remove the Float fields from prisma inputs.
    # In auth/max/route.ts:
    c = re.sub(r'balance:\s*\{\s*increment:\s*Number\(bonusKopecks\)\s*/\s*100\s*\},?', '', c)
    c = re.sub(r'amount:\s*Number\(bonusKopecks\)\s*/\s*100,?', '', c)
    
    # In buy-lead/route.ts:
    c = re.sub(r'balance:\s*\{\s*decrement:\s*kopecksToRubles\(price\)\s*\},?', '', c)
    c = re.sub(r'price:\s*kopecksToRubles\(price\),?', '', c)
    c = re.sub(r'amount:\s*kopecksToRubles\(price\),?', '', c)
    
    # In yookassa.ts:
    c = re.sub(r'balance:\s*\{\s*increment:\s*kopecksToRubles\(order\.amount\)\s*\},?', '', c)
    c = re.sub(r'amount:\s*kopecksToRubles\(order\.amount\),?', '', c)

    # In payments/status/route.ts
    # amount: kopecksToRubles(...)
    c = re.sub(r'amount:\s*kopecksToRubles\([^)]+\),?', '', c)

    # Now replace Kopecks with normal names
    c = c.replace('balanceKopecks', 'balance')
    c = c.replace('amountKopecks', 'amount')
    c = c.replace('priceKopecks', 'price')
    
    # BigInt fixes for money (maxId should stay BigInt if possible, but let's see)
    # getOnboardingBonus
    c = c.replace('BigInt(raw)', 'Math.round(Number(raw))')
    c = c.replace('100_000_000n', '100_000_000')
    c = c.replace('0n', '0')
    c = c.replace('function getOnboardingBonus(): bigint', 'function getOnboardingBonus(): number')
    
    # buy-lead
    c = re.sub(r'BigInt\(Math\.round\(([^)]+)\)\)', r'Math.round(\1)', c)
    c = re.sub(r'BigInt\(([^)]+)\)', r'Number(\1)', c)
    
    # other bigints like onusKopecks > 0n
    c = c.replace('0n', '0')
    
    # In UI, display values need / 100
    # user.balance -> user.balance / 100 (where it was already displaying it)
    # It's tricky to find all. I'll just do it for React components.
    if path.endswith('.tsx') or 'components' in path or 'app/(admin)' in path or 'app/(dashboard)' in path:
        c = re.sub(r'user\.balance(?!Kopecks|:)', r'(user.balance / 100)', c)
        c = re.sub(r'lead\.price(?!Kopecks|:)', r'(lead.price / 100)', c)
        c = re.sub(r'category\.leadPrice(?!:)', r'(category.leadPrice / 100)', c)
        c = re.sub(r'category\.subscriptionPrice(?!:)', r'(category.subscriptionPrice / 100)', c)
        c = re.sub(r'\(user\.balance / 100\) / 100', r'user.balance / 100', c) # fix double division if any
        c = re.sub(r'\(\(user\.balance / 100\)\)', r'(user.balance / 100)', c)

    # In yookassa.ts
    c = c.replace('let amount: bigint', 'let amount: number')
    c = c.replace('function amountValue(kopecks: bigint)', 'function amountValue(kopecks: number)')
    
    # in webhooks/max/route.ts
    c = c.replace('Math.round(Number(parsed.amount * 100))', 'Math.round(Number(parsed.amount * 100))')
    # wait, webhook/max/route.ts had error TS2345: Argument of type 'bigint' is not assignable to parameter of type 'number'
    
    # current-user.ts
    c = c.replace('export interface CurrentUser {', 'export interface CurrentUser {')

    if orig != c:
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(c)

print('Refactored')
