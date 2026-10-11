p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\auth\LoginPage.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

c = c.replace('{ role: "collector", label: "Collector", blurb: "Get offers & pick up scrap", icon: <Truck className="h-4 w-4" />, requiresAddress: true }', '{ role: "collector", label: "Collector", blurb: "Get offers & pick up scrap", icon: <Truck className="h-4 w-4" />, requiresAddress: false }')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')