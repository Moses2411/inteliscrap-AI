p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\seed_demo.py'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

c = c.replace('UserRole.household', 'UserRole.seller')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')