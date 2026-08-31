import codecs, re, glob

for path in glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    with codecs.open(path, 'r', 'utf-8') as f:
        c = f.read()
    
    orig = c
    # Replace BigInt constants
    c = re.sub(r'\b100_000_000n\b', '100_000_000', c)
    c = re.sub(r'\b0n\b', '0', c)
    c = re.sub(r'BigInt\((.*?)\)', r'Math.round(Number(\1))', c)
    c = re.sub(r'bigint', 'number', c)
    
    # Replace the duplicate assignments in backend
    # auth route
    c = re.sub(r'balanceKopecks:\s*\{\s*increment:\s*bonusKopecks\s*\},?\s*balance:\s*\{\s*increment:\s*Number\(bonusKopecks\)\s*/\s*100\s*\}', r'balance: { increment: bonusKopecks }', c)
    c = re.sub(r'amount:\s*Number\(bonusKopecks\)\s*/\s*100,?\s*amountKopecks:\s*bonusKopecks', r'amount: bonusKopecks', c)
    
    # yookassa
    c = re.sub(r'amount:\s*Number\([^)]+\)\s*/\s*100,?\s*amountKopecks:\s*([a-zA-Z0-9_]+)', r'amount: \1', c)
    c = re.sub(r'balanceKopecks:\s*\{\s*increment:\s*([a-zA-Z0-9_.]+)\s*\},?\s*balance:\s*\{\s*increment:\s*Number\([^)]+\)\s*/\s*100\s*\}', r'balance: { increment: \1 }', c)
    
    # buy-lead
    c = re.sub(r'balanceKopecks:\s*\{\s*decrement:\s*([a-zA-Z0-9_]+)\s*\},?\s*balance:\s*\{\s*decrement:\s*Number\([^)]+\)\s*/\s*100\s*\}', r'balance: { decrement: \1 }', c)
    c = re.sub(r'price:\s*Number\([^)]+\)\s*/\s*100,?\s*priceKopecks:\s*([a-zA-Z0-9_]+)', r'price: \1', c)
    
    # General renaming
    c = c.replace('balanceKopecks', 'balance')
    c = c.replace('amountKopecks', 'amount')
    c = c.replace('priceKopecks', 'price')
    
    # In UI, when doing user.balance we might need to show it as rubles if the UI used alance previously.
    # UI used user.balance (which was Float). So it was already in rubles.
    # Now user.balance is in kopecks.
    # Where did it use it? 
    # e.g. <span className="font-medium">{user.balance.toFixed(2)} ?</span> -> <span className="font-medium">{(user.balance / 100).toFixed(2)} ?</span>
    # <div className="text-xl font-bold">{user.balance} ?</div> -> <div className="text-xl font-bold">{user.balance / 100} ?</div>
    
    c = re.sub(r'user\.balance\.toFixed\((.*?)\)', r'(user.balance / 100).toFixed(\1)', c)
    c = re.sub(r'\{user\.balance\}', r'{user.balance / 100}', c)
    
    # Lead price
    c = re.sub(r'lead\.price\.toFixed\((.*?)\)', r'(lead.price / 100).toFixed(\1)', c)
    c = re.sub(r'\{lead\.price\}', r'{lead.price / 100}', c)
    c = re.sub(r'\{category\.leadPrice\}', r'{category.leadPrice / 100}', c)
    c = re.sub(r'\{category\.subscriptionPrice\}', r'{category.subscriptionPrice / 100}', c)
    
    # Number(bonusKopecks) -> bonusKopecks
    c = c.replace('Number(bonusKopecks)', 'bonusKopecks')
    
    if orig != c:
        with codecs.open(path, 'w', 'utf-8') as f:
            f.write(c)

print('Done replacement')
