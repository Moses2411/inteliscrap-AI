import { useCallback, useEffect, useState } from "react";
import type { ScrapScan } from "../types";
import type { ScanRecord } from "../types/bento";
import { db, getLocalScans, saveScanLocally } from "../services/db";
import { syncScans } from "../services/sync";
import { hazardLevelFor, slugForMaterial } from "../lib/bentoPricing";

export function toScanRecord(scan: ScrapScan): ScanRecord {
  const slug = slugForMaterial(scan.material_class);
  const hazards = scan.toxicity_hazards ?? [];
  return {
    id: scan.id,
    materialClass: scan.material_class,
    materialSlug: slug,
    subGrade: scan.sub_grade,
    confidence: scan.confidence_score,
    weightKg: scan.weight_est_kg ?? 0,
    valueNgn: scan.estimated_naira_value,
    hazardLevel: hazardLevelFor(slug, hazards),
    hazards,
    synced: scan.is_synced,
    capturedAt: scan.captured_at,
  };
}

/**
 * IndexedDB-backed scan log with cloud sync.
 *
 * Records are written to the local Dexie store immediately (offline-first) and
 * pushed to the server on demand or automatically when connectivity returns.
 */
export function useScanHistory(userId?: string) {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const scans = await getLocalScans();
      setRecords(scans.map(toScanRecord));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (scan: ScrapScan) => {
      await saveScanLocally(scan);
      await refresh();
    },
    [refresh],
  );

  const syncNow = useCallback(async () => {
    if (!userId || syncing) return;
    setSyncing(true);
    try {
      const result = await syncScans(userId);
      if (result) setLastSyncAt(new Date().toISOString());
    } catch {
      // Sync failed — items stay queued and retry on the next trigger.
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [userId, syncing, refresh]);

  const clear = useCallback(async () => {
    await db.scans.clear();
    await refresh();
  }, [refresh]);

  // Auto-sync as soon as the device is back online.
  useEffect(() => {
    const onOnline = () => {
      void syncNow();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncNow]);

  const pending = records.filter((record) => !record.synced).length;

  return {
    records,
    loading,
    syncing,
    lastSyncAt,
    pending,
    refresh,
    add,
    syncNow,
    clear,
  };
}
