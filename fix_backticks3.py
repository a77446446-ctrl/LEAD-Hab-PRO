import re
with open('src/app/(admin)/admin/settings/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r'addLog\(.*?, \'info\'\);\n\s*\} catch \(e\) \{\}', 'addLog(Retention set, \'info\');\n    } catch (e) {}', c)

with open('src/app/(admin)/admin/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
