import os

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'НАСТРОЙКИ МАКС' in content:
                content = content.replace('НАСТРОЙКИ МАКС', 'НАСТРОЙКИ')
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
