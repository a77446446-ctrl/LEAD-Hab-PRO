with open('src/app/(admin)/admin/settings/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'catch (e) {}' in line and 'addLog' in lines[i-1]:
        lines[i-1] = "      addLog(Срок хранения лидов изменен на  дн., 'info');\n"
        break

with open('src/app/(admin)/admin/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(''.join(lines))
