p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\ScanPage.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

old = '''export default function ScanPage() {
  const { role } = useApp();
  
  // Only seller and collector can access scanning functionality
  if (role !== "seller" && role !== "collector") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Scanning and listing functionality is only available for Sellers and Collectors.
          </p>
        </div>
      </div>
    );
  }

  const [result, setResult] = useState<VisionAnalysis | null>(null);'''

new = '''export default function ScanPage() {
  const { user } = useApp();
  const role = user?.role;
  
  // Only seller and collector can access scanning functionality
  if (role !== "seller" && role !== "collector") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Scanning and listing functionality is only available for Sellers and Collectors.
          </p>
        </div>
      </div>
    );
  }

  const [result, setResult] = useState<VisionAnalysis | null>(null);'''

c = c.replace(old, new)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')