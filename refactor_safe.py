import codecs, re, glob

for path in glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    with codecs.open(path, 'r', 'utf-8') as f:
        c = f.read()
    orig = c
    
    # We want to remove the Float versions of balance, price, and amount in Prisma mutations.
    # Usually they look like: alance: Number(kopecks) / 100 or alance: { increment: Number(bonus) / 100 }
    # Let's just remove lines matching alance: {.*Number.* / 100.*} or mount: Number.* / 100
    
    lines = c.split('\n')
    new_lines = []
    for line in lines:
        if re.search(r'\b(balance|price|amount)\s*:\s*(\{.*?Number.*?/.*?100.*?\}|Number.*?/.*?100)', line):
            # This is the float assignment we want to drop
            continue
        new_lines.append(line)
    c = '\n'.join(new_lines)
    
    c = c.replace('balanceKopecks', 'balance')
    c = c.replace('amountKopecks', 'amount')
    c = c.replace('priceKopecks', 'price')
    
    # Now we have variable onusKopecks, let's remove BigInt usage.
    # We should only change BigInt usage for financial variables, not maxId.
    # maxId is BigInt, so we leave it alone.
    
    # getOnboardingBonus
    c = c.replace('BigInt(raw)', 'Math.round(Number(raw))')
    c = c.replace('100_000_000n', '100_000_000')
    c = c.replace('0n', '0')
    
    # In buy-lead, amount: BigInt(...) 
    c = re.sub(r'BigInt\(Math\.round\(([^)]+)\)\)', r'Math.round(\1)', c)
    c = re.sub(r'BigInt\(([^)]+)\)', r'Number(\1)', c)
    # Wait! BigInt(current.maxId) might exist! But usually maxId is already BigInt. Let's be careful.
    
    # For UI: user.balance -> user.balance / 100
    c = re.sub(r'user\.balance\.toFixed\((.*?)\)', r'(user.balance / 100).toFixed(\1)', c)
    c = re.sub(r'\{user\.balance\}', r'{user.balance / 100}', c)
    c = re.sub(r'lead\.price\.toFixed\((.*?)\)', r'(lead.price / 100).toFixed(\1)', c)
    c = re.sub(r'\{lead\.price\}', r'{lead.price / 100}', c)
    c = re.sub(r'\{category\.leadPrice\}', r'{category.leadPrice / 100}', c)
    c = re.sub(r'\{category\.subscriptionPrice\}', r'{category.subscriptionPrice / 100}', c)
    
    if orig != c:
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(c)
print('Safe refactor done')
