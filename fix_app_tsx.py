p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\App.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

# Remove the syncRoleFromServer useEffect
old = '''  // Reconcile the cached role with the server on boot so route guards and
  // API calls never operate on a stale role (source of truth = backend).
  useEffect(() => {
    if (!getToken()) return;
    syncRoleFromServer().then(() => setRoleVersion((v) => v + 1));
  }, []);'''

c = c.replace(old, '')

# Also remove syncRoleFromServer import
c = c.replace('import { getRole, getToken, syncRoleFromServer, type UserRole } from "./services/auth";', 'import { getRole, getToken, type UserRole } from "./services/auth";')

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')