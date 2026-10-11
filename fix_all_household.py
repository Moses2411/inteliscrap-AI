import os

replacements = {
    # Backend
    'UserRole.household': 'UserRole.seller',
    'user.role == "household"': 'user.role == "seller"',
    'user.role == "household"': 'user.role == "seller"',
    '"household"': '"seller"',
    "'household'": "'seller'",
    'role="household"': 'role="seller"',
    "role='household'": "role='seller'",
    'household': 'seller',  # This might be too broad, be careful
}

# Files to update
files = [
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\schemas.py',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\services\auth_service.py',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\services\subscription_service.py',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\api\hubs.py',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\App.tsx',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\components\Pickup\PostPickupForm.tsx',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\lib\nav.ts',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\SettingsPage.tsx',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\auth\LoginPage.tsx',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\dashboard\CollectorDashboard.tsx',
    r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\services\auth.ts',
]

for path in files:
    if not os.path.exists(path):
        print(f'Missing: {path}')
        continue
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        c = f.read()
    
    original = c
    c = c.replace('UserRole.household', 'UserRole.seller')
    c = c.replace('"household"', '"seller"')
    c = c.replace("'household'", "'seller'")
    c = c.replace('household', 'seller')  # broader
    
    if c != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f'Updated: {path}')

print('Done')