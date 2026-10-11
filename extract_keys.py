import re
p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\components\Pickup\PostPickupForm.tsx'
with open(p, encoding='utf-8', errors='ignore') as f:
    c = f.read()
matches = re.findall(r't\([\'"]([^\'"]+)[\'"]\)', c)
for m in sorted(set(matches)):
    print(m)