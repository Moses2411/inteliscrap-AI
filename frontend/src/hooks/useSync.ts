import { useCallback, useEffect, useState } from "react";
import { syncScans } from "../services/sync";
import { getLocalScans, getUnsyncedScans, SCANS_CHANGED_EVENT } from "../services/db";
import { useApp } from "../store/appStore";

const AUTO_SYNC_INTERVAL_MS = 60_000;

// Shared across hook instances so the page button and the app-level auto-sync
// worker never upload the same queue twice.
let syncInProgress = false;

export function useSync() {
  const { user, setRecentScans, setCachedPrices } = useApp();
  const [syncing, setSyncing] = useState(false);

  const refreshLocalScans = useCallback(async () => {
    const scans = await getLocalScans();
    setRecentScans(scans);
  }, [setRecentScans]);

  const triggerSync = useCallback(async () => {
    if (!user || syncInProgress || !navigator.onLine) return false;
    syncInProgress = true;
    setSyncing(true);
    try {
      const result = await syncScans(user.id);
      if (result) {
        if (result.latest_prices.length > 0) {
          setCachedPrices(result.latest_prices);
        }
        await refreshLocalScans();
      }
      return result != null;
    } catch {
      // Sync failed silently — will retry on the next trigger
      return false;
    } finally {
      syncInProgress = false;
      setSyncing(false);
    }
  }, [user, setCachedPrices, refreshLocalScans]);

  return { triggerSync, refreshLocalScans, syncing };
}

/**
 * Runs the sync queue automatically while the app is open: on start-up, when
 * the device comes back online, when the tab regains focus and every minute.
 * Local scan changes (new scan, delete, listing link) also kick a sync.
 */
export function useAutoSync() {
  const { user, is_online } = useApp();
  const { triggerSync } = useSync();

  useEffect(() => {
    if (!user || !is_online) return;
    let disposed = false;

    const syncIfPending = async () => {
      if (disposed || syncInProgress) return;
      const pending = await getUnsyncedScans();
      if (!disposed && pending.length > 0) {
        await triggerSync();
      }
    };

    void syncIfPending();

    const intervalId = window.setInterval(syncIfPending, AUTO_SYNC_INTERVAL_MS);
    const onFocus = () => void syncIfPending();
    const onOnline = () => void syncIfPending();
    const onScansChanged = () => void syncIfPending();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncIfPending();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener(SCANS_CHANGED_EVENT, onScansChanged);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SCANS_CHANGED_EVENT, onScansChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, is_online, triggerSync]);
}
