import {
  Clock,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { hazardLevelFor } from "../../lib/bentoPricing";
import type { HistoryFilter, ScanRecord } from "../../types/bento";

interface ScanHistoryTableProps {
  records: ScanRecord[];
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
  onSync: () => void;
  onClear: () => void;
  syncing: boolean;
  lastSyncAt?: string;
  loading: boolean;
}

const FILTERS: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Queued" },
  { value: "synced", label: "Synced" },
];

function naira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScanHistoryTable({
  records,
  filter,
  onFilter,
  onSync,
  onClear,
  syncing,
  lastSyncAt,
  loading,
}: ScanHistoryTableProps) {
  const visible = records.filter((record) => {
    if (filter === "pending") return !record.synced;
    if (filter === "synced") return record.synced;
    return true;
  });

  const exportCsv = () => {
    const header = ["timestamp", "material", "weight_kg", "value_ngn", "hazard_level", "synced"];
    const rows = visible.map((record) => [
      record.capturedAt,
      record.materialClass,
      record.weightKg,
      record.valueNgn,
      record.hazardLevel,
      record.synced,
    ]);
    const csv = [header, ...rows]
      .map((columns) => columns.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inteliscrap-scans-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (records.length === 0) return;
    if (window.confirm("Clear all locally stored scans? This cannot be undone.")) {
      onClear();
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1"
          role="group"
          aria-label="Filter scans"
        >
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "tap-target rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === option.value
                  ? "bg-eco-emerald text-obsidian-950"
                  : "text-slate-300 hover:text-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {lastSyncAt ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()}` : "Not synced yet"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="tap-target inline-flex h-10 items-center gap-2 rounded-xl bg-eco-emerald px-3.5 text-xs font-bold text-obsidian-950 transition-colors hover:bg-eco-emerald-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="tap-target inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={records.length === 0}
            className="tap-target inline-flex h-10 items-center gap-2 rounded-xl border border-eco-red/25 px-3.5 text-xs font-semibold text-eco-red-glow transition-colors hover:bg-eco-red/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading local history…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center">
          <p className="text-sm font-semibold text-slate-300">No scans here yet</p>
          <p className="max-w-sm text-xs text-slate-500">
            Captured scans are stored on your device and queued for cloud sync — even while offline.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-white/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Captured</th>
                  <th className="px-4 py-2.5 font-semibold">Material</th>
                  <th className="px-4 py-2.5 font-semibold">Weight</th>
                  <th className="px-4 py-2.5 font-semibold">Value</th>
                  <th className="px-4 py-2.5 font-semibold">Safety</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {visible.map((record) => {
                  const level = hazardLevelFor(record.materialSlug, record.hazards);
                  return (
                    <tr key={record.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">{when(record.capturedAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {record.materialClass}
                        {record.subGrade && (
                          <span className="ml-2 text-xs text-slate-500">{record.subGrade}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
                        {record.weightKg.toFixed(1)} kg
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-eco-lime-glow">
                        {naira(record.valueNgn)}
                      </td>
                      <td className="px-4 py-3">
                        {level === "low" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-eco-emerald-glow">
                            <ShieldCheck className="h-4 w-4" /> Safe
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs capitalize text-eco-amber-glow">
                            <ShieldAlert className="h-4 w-4" /> {level}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "eco-chip",
                            record.synced
                              ? "border-eco-emerald/25 bg-eco-emerald/10 text-eco-emerald-glow"
                              : "border-eco-amber/25 bg-eco-amber/10 text-eco-amber-glow",
                          )}
                        >
                          {record.synced ? "Synced" : "Queued"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-2 md:hidden">
            {visible.map((record) => {
              const level = hazardLevelFor(record.materialSlug, record.hazards);
              return (
                <li
                  key={record.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {record.materialClass}
                      </p>
                      <p className="text-xs text-slate-500">{when(record.capturedAt)}</p>
                    </div>
                    <span
                      className={cn(
                        "eco-chip shrink-0",
                        record.synced
                          ? "border-eco-emerald/25 bg-eco-emerald/10 text-eco-emerald-glow"
                          : "border-eco-amber/25 bg-eco-amber/10 text-eco-amber-glow",
                      )}
                    >
                      {record.synced ? "Synced" : "Queued"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400">
                      {record.weightKg.toFixed(1)} kg · {naira(record.valueNgn)}
                    </span>
                    {level === "low" ? (
                      <span className="inline-flex items-center gap-1 text-eco-emerald-glow">
                        <ShieldCheck className="h-3.5 w-3.5" /> Safe
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 capitalize text-eco-amber-glow">
                        <ShieldAlert className="h-3.5 w-3.5" /> {level}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
