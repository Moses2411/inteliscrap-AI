p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\components\Pickup\PostPickupForm.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

c = c.replace('{ value: "collector", label: "Collector", hint: "I pick up scrap", requiresAddress: true }', '{ value: "collector", label: "Collector", hint: "I pick up scrap", requiresAddress: false }')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')