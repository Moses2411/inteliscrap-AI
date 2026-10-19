import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { History, RefreshCw, Trash2, AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../components/ui/PageMotion";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatConfidence, formatDateTime, formatNairaEstimate } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";
import { useTranslation } from "../hooks/useTranslation";
import { cn } from "../lib/cn";
import { useApp } from "../store/appStore";
import { getRole } from "../services/auth";

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
  const { user } = useApp();
  const role = user?.role ?? getRole();
  const navigate = useNavigate();
  
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

  const { t } = useTranslation();
  const { triggerSync } = useSync();
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "synced" | "pending" | "deleted">("all");
  const [grouped, setGrouped] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getLocalScans();
      setScans(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = scans
    .filter((s) => {
      if (filter === "all") return true;
      if (filter === "synced") return s.is_synced && !s.is_deleted;
      if (filter === "pending") return !s.is_synced && !s.is_deleted;
      if (filter === "deleted") return s.is_deleted;
      return true;
    })
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

  const groupedScans = useMemo(
    () =>
      filtered.reduce((acc, scan) => {
        const date = new Date(scan.captured_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        (acc[date] ??= []).push(scan);
        return acc;
      }, {} as Record<string, ScrapScan[]>),
    [filtered]
  );

  const stats = useMemo(
    () => ({
      total: scans.length,
      synced: scans.filter((s) => s.is_synced && !s.is_deleted).length,
      pending: scans.filter((s) => !s.is_synced && !s.is_deleted).length,
      deleted: scans.filter((s) => s.is_deleted).length,
      value: scans
        .filter((s) => !s.is_deleted)
        .reduce((sum, s) => sum + s.estimated_naira_value, 0),
    }),
    [scans]
  );

  async function handleSync() {
    await triggerSync();
    const data = await getLocalScans();
    setScans(data);
  }

  async function handleDelete(id: string) {
    await softDeleteScan(id);
    const data = await getLocalScans();
    setScans(data);
  }

  return (
    <PageMotion className="space-y-6">
      <motion.div variants={pageItem}>
        <PageHeader
          title={t("history")}
          subtitle={t("history_subtitle")}
          actions={
            <Button variant="secondary" size="sm" onClick={handleSync} loading={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </Button>
          }
        />
      </motion.div>

      {/* Metrics — icon-free, responsive grid */}
      <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("total_scans")} value={stats.total} hint={t("hint_total_scans")} />
        <StatCard label={t("synced")} value={stats.synced} hint={t("hint_synced")} />
        <StatCard label={t("pending_sync")} value={stats.pending} hint={t("hint_pending_sync")} />
        <StatCard
          label={t("estimated_value")}
          value={formatNairaEstimate(stats.value)}
          hint={t("hint_estimated_value")}
        />
      </motion.div>

      <motion.div variants={pageItem} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("filter")}:</label>
          <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 dark:bg-slate-800">
            {(["all", "synced", "pending", "deleted"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                  filter === f
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-200 dark:text-slate-900"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                )}
              >
                {t(f)}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={grouped}
              onChange={(e) => setGrouped(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            {t("group_by_date")}
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title={t("no_scans_yet")}
            subtitle={t("no_scans_yet_desc")}
          />
        ) : grouped ? (
          <motion.div variants={pageStagger} className="space-y-6">
            {Object.entries(groupedScans).map(([date, dayScans]) => (
              <Card key={date} className="overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{date}</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="group cursor-pointer px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
                      onClick={() => navigate(`/history/${scan.id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/history/${scan.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            accentFor(scan.material_class),
                          )}
                        >
                          <Trash2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {scan.material_class}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatConfidence(scan.confidence_score)} •
                            {formatNairaEstimate(scan.estimated_naira_value)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          tone={
                            scan.is_deleted
                              ? "slate"
                              : scan.is_synced
                              ? "green"
                              : "amber"
                          }
                        >
                          {scan.is_deleted
                            ? t("deleted")
                            : scan.is_synced
                            ? t("synced")
                            : t("pending")}
                        </Badge>
                        {!scan.is_deleted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleDelete(scan.id);
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-150 group-hover:text-brand-500 group-hover:translate-x-0.5 dark:text-slate-600 dark:group-hover:text-brand-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </motion.div>
        ) : (
          <motion.div variants={pageStagger} className="space-y-3">
            {filtered.map((scan) => (
              <Card
                key={scan.id}
                hover
                className="group cursor-pointer transition-all duration-150 hover:border-brand-200 hover:shadow-card dark:hover:border-brand-900"
                onClick={() => navigate(`/history/${scan.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/history/${scan.id}`);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        accentFor(scan.material_class),
                      )}
                    >
                      <Trash2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {scan.material_class}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(scan.captured_at)} • {formatConfidence(scan.confidence_score)} •
                        {formatNairaEstimate(scan.estimated_naira_value)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      tone={
                        scan.is_deleted
                          ? "slate"
                          : scan.is_synced
                          ? "green"
                          : "amber"
                      }
                    >
                      {scan.is_deleted
                        ? t("deleted")
                        : scan.is_synced
                        ? t("synced")
                        : t("pending")}
                    </Badge>
                    {!scan.is_deleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleDelete(scan.id);
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-150 group-hover:text-brand-500 group-hover:translate-x-0.5 dark:text-slate-600 dark:group-hover:text-brand-400" />
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>
        )}
      </motion.div>
    </PageMotion>
  );
}