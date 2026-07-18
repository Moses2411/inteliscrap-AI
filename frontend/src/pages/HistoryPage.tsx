import { useEffect, useState, useCallback } from "react";
import { getLocalScans, softDeleteScan } from "../services/db";
import { formatNaira, formatDateTime, formatConfidence } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";

export default function HistoryPage() {
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const { triggerSync } = useSync();

  const loadScans = useCallback(() => {
    getLocalScans().then(setScans);
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("Delete this scan from your history?")) return;
    await softDeleteScan(id);
    loadScans();
  }, [loadScans]);

  if (scans.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-gray-500">No scans yet</p>
        <p className="text-xs text-gray-400">Snap a photo of scrap to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">History</h2>
        <button onClick={triggerSync} className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Sync Now
        </button>
      </div>

      <div className="space-y-2">
        {scans.map((scan) => (
          <div key={scan.id} className="card flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{scan.material_class}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span>{formatDateTime(scan.captured_at)}</span>
                <span>·</span>
                <span>{formatConfidence(scan.confidence_score)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-brand-600">{formatNaira(scan.estimated_naira_value)}</p>
                <span
                  className={`text-[10px] font-medium ${scan.is_synced ? "text-green-600" : "text-yellow-600"}`}
                >
                  {scan.is_synced ? "Synced" : "Pending"}
                </span>
              </div>
              <button
                onClick={() => handleDelete(scan.id)}
                className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                aria-label="Delete scan"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
