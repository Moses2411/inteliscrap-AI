p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\models.py'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

# Change household to seller in UserRole enum
c = c.replace('household = "household"', 'seller = "seller"')
c = c.replace('UserRole.household', 'UserRole.seller')
c = c.replace('default=UserRole.household', 'default=UserRole.seller')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')