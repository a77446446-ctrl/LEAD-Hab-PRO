with open('src/app/(admin)/admin/settings/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'addLog' in line and 'info' in line and 'days' not in line and 'newInterval' not in line and 'catch' not in lines[i+1]:
        # This is a bit risky. Let's just do a replace.
        pass

c = ''.join(lines)
import re
c = re.sub(r'addLog\(.*?, \'info\'\);\n\s*\} catch \(e\) \{\}', 'addLog(Срок хранения лидов изменен на  дн., \'info\');\n    } catch (e) {}', c)

with open('src/app/(admin)/admin/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
