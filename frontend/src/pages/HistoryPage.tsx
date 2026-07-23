import { useEffect, useState, useCallback } from "react";
import { Inbox, RefreshCw, Trash2, CheckCircle2, Clock3 } from "lucide-react";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatNaira, formatDateTime, formatConfidence } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";
import { useTranslation } from "../hooks/useTranslation";

// Deterministic accent color per material — presentation only, no data change.
const ACCENTS = [
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
];

function accentFor(label: string) {
  const hash = Array.from(label).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return ACCENTS[hash % ACCENTS.length];
}

function initialsFor(label: string) {
  return label.trim().slice(0, 2).toUpperCase();
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const { t } = useTranslation();
  const { triggerSync } = useSync();

  const loadScans = useCallback(() => {
    getLocalScans().then(setScans);
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm(t("delete_confirm"))) return;
    await softDeleteScan(id);
    loadScans();
  }, [loadScans, t]);

  // ── Empty state ────────────────────────────────────────────────
  if (scans.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Inbox className="h-7 w-7 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-700">{t("no_scans_yet")}</p>
          <p className="text-xs text-gray-400">{t("no_scans_hint")}</p>
        </div>
      </div>
    );
  }

  const pendingCount = scans.filter((s) => !s.is_synced).length;

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900">{t("history")}</h2>
          <p className="text-xs text-gray-400">
            {scans.length} {scans.length === 1 ? t("scan_noun") : t("scan_noun_plural")}
            {pendingCount > 0 ? ` · ${pendingCount} ${t("pending")}` : ""}
          </p>
        </div>
        <button
          onClick={triggerSync}
          className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 active:scale-95"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("sync_now")}
        </button>
      </div>

      {/* List */}
      <ul className="space-y-2">
        {scans.map((scan) => {
          const accent = accentFor(scan.material_class);
          return (
            <li
              key={scan.id}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Material icon */}
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${accent.bg} ${accent.text}`}
                aria-hidden="true"
              >
                {initialsFor(scan.material_class)}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{scan.material_class}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{formatDateTime(scan.captured_at)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0">{formatConfidence(scan.confidence_score)}</span>
                </div>
              </div>

              {/* Value + sync + delete */}
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{formatNaira(scan.estimated_naira_value)}</p>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium ${scan.is_synced ? "text-green-600" : "text-amber-600"
                      }`}
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 active:scale-95"
                  aria-label={`${t("delete")} ${scan.material_class} ${t("scan_noun")}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}