import json, os, sys

src = r'C:/Users/huang/AppData/Local/Temp/claude/C--Users-huang-Desktop-----------------/83b587c5-db31-43c0-aab9-f7eb79883d0f/tasks/wya0qgx30.output'
outdir = r'C:/Users/huang/Desktop/《诡异药剂师》同人角色卡制作计划/Handoffs/战力提取'

with open(src, encoding='utf-8') as f:
    data = json.load(f)

result = data['result']
os.makedirs(outdir, exist_ok=True)

for key, fname in [('framework', '战力_01_体系框架.md'),
                   ('abilities', '战力_02_能力战力.md'),
                   ('details', '战力_03_细节佐证.md')]:
    val = result.get(key)
    if val:
        path = os.path.join(outdir, fname)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(val)
        print(f'{fname}: {len(val)} chars -> {path}')
    else:
        print(f'{fname}: MISSING')

print('critic:', repr(result.get('critic'))[:120])
print('stats:', result.get('stats'))
