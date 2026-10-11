p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\HistoryPage.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

# Fix imports
c = c.replace('import { useCallback, useEffect, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')
c = c.replace('import { PageHeader } from "../components/ui/PageHeader";', 'import { PageHeader } from "../components/ui/PageHeader";\nimport { StatCard } from "../components/ui/StatCard";')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')