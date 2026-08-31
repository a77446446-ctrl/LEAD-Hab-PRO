import glob, re
matches = 0
files_with_matches = []
for f in glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    if re.search(r'\b(balance|price|amount)\b', content, re.IGNORECASE):
        files_with_matches.append(f)
        matches += len(re.findall(r'\b(balance|price|amount)\b', content, re.IGNORECASE))
print(f'Matches: {matches} across {len(files_with_matches)} files')
for f in files_with_matches:
    print(f)
