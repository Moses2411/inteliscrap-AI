p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\frontend\src\pages\HistoryPage.tsx'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

old = '''import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Coins, History, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../components/ui/PageMotion";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatConfidence, formatDateTime, formatNaira } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";
import { useTranslation } from "../hooks/useTranslation";
import { cn } from "../lib/cn";'''

new = '''import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Coins, History, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../components/ui/PageMotion";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatConfidence, formatDateTime, formatNaira } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";
import { useTranslation } from "../hooks/useTranslation";
import { cn } from "../lib/cn";
import { useApp } from "../store/appStore";'''

c = c.replace(old, new)

old2 = '''function accentFor(label: string): string {
  const hash = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ACCENTS[hash % ACCENTS.length];
}'''

new2 = '''function accentFor(label: string): string {
  const hash = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ACCENTS[hash % ACCENTS.length];
}

export default function HistoryPage() {
  const { user } = useApp();
  const role = user?.role;
  
  // Only sellers can access history
  if (role !== "seller") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            History is only available for Sellers.
          </p>
        </div>
      </div>
    );
  }

  // Original component logic continues below
  function accentFor(label: string): string {
    const hash = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return ACCENTS[hash % ACCENTS.length];
  }

  const [scans, setScans] = useState<ScrapScan[]>([]);'''

c = c.replace(old2, new2)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')