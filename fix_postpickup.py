p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\components\Pickup\PostPickupForm.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

# Update role options from Household to Seller
c = c.replace('{ value: "seller", label: "Household"', '{ value: "seller", label: "Seller"')
c = c.replace('label: "Household"', 'label: "Seller"')
c = c.replace('Household / Seller', 'Seller')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')