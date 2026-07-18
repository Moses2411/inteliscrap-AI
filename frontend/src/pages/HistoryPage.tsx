import { useEffect, useState } from "react";
import { getLocalScans } from "../services/db";
import { formatNaira, formatDateTime, formatConfidence } from "../utils/formatters";
import type { ScrapScan } from "../types";
import { useSync } from "../hooks/useSync";

export default function HistoryPage() {
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const { triggerSync } = useSync();

  useEffect(() => {
    getLocalScans().then(setScans);
  }, []);

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
          <div key={scan.id} className="card flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{scan.material_class}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span>{formatDateTime(scan.captured_at)}</span>
                <span>·</span>
                <span>{formatConfidence(scan.confidence_score)}</span>
              </div>
            </div>
            <div className="ml-3 text-right">
              <p className="text-sm font-bold text-brand-600">{formatNaira(scan.estimated_naira_value)}</p>
              <span
                className={`text-[10px] font-medium ${scan.is_synced ? "text-green-600" : "text-yellow-600"}`}
              >
                {scan.is_synced ? "Synced" : "Pending"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
