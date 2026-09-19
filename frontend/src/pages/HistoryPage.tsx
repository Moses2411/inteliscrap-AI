import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, History, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatConfidence, formatDateTime, formatNaira } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";
import { useTranslation } from "../hooks/useTranslation";
import { cn } from "../lib/cn";

const ACCENTS = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-gold-100 text-gold-700 dark:bg-gold-950 dark:text-gold-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

function accentFor(label: string): string {
  const hash = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ACCENTS[hash % ACCENTS.length];
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const { triggerSync } = useSync();
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScans = useCallback(() => {
    getLocalScans()
      .then(setScans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t("delete_confirm"))) return;
      await softDeleteScan(id);
      loadScans();
    },
    [loadScans, t],
  );

  const pendingCount = scans.filter((s) => !s.is_synced).length;
  const totalValue = scans.reduce((a, s) => a + (s.estimated_naira_value || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t("history")}
        subtitle={`${scans.length} scan${scans.length === 1 ? "" : "s"} on this device`}
        actions={
          <div className="flex items-center gap-2">
            {pendingCount > 0 && <Badge tone="amber">{pendingCount} pending</Badge>}
            <button onClick={triggerSync} className="btn-secondary h-9 px-3 text-[13px]">
              <RefreshCw className="h-3.5 w-3.5" />
              {t("sync_now")}
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card pad className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total scans</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{scans.length}</p>
          </div>
          <History className="h-5 w-5 text-brand-500" />
        </Card>
        <Card pad className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estimated value</p>
            <p className="mt-0.5 text-xl font-bold text-brand-600 dark:text-brand-400">{formatNaira(totalValue)}</p>
          </div>
          <span className="text-xl" aria-hidden="true">💰</span>
        </Card>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </div>
      ) : scans.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title={t("no_scans_yet")}
          subtitle={t("no_scans_hint")}
        />
      ) : (
        <ul className="space-y-2.5">
          {scans.map((scan) => (
            <li key={scan.id}>
              <Card hover className="flex items-center gap-3 !p-3.5">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    accentFor(scan.material_class),
                  )}
                  aria-hidden="true"
                >
                  {scan.material_class.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{scan.material_class}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{formatDateTime(scan.captured_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">{formatConfidence(scan.confidence_score)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-600 dark:text-brand-400">
                      {formatNaira(scan.estimated_naira_value)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold",
                        scan.is_synced
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {scan.is_synced ? (
                        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                      ) : (
                        <Clock3 className="h-2.5 w-2.5" aria-hidden="true" />
                      )}
                      {scan.is_synced ? t("synced") : t("pending")}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(scan.id)}
                    className="btn-icon !h-9 !w-9 hover:!bg-red-50 hover:!text-red-500 dark:hover:!bg-red-950"
                    aria-label={`${t("delete")} ${scan.material_class}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}