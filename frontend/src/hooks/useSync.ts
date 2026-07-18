import { useCallback, useRef } from "react";
import { syncScans } from "../services/sync";
import { getLocalScans } from "../services/db";
import { useApp } from "../store/appStore";

export function useSync() {
  const { user, setRecentScans, setCachedPrices } = useApp();
  const sync_in_progress = useRef(false);

  const refreshLocalScans = useCallback(async () => {
    const scans = await getLocalScans();
    setRecentScans(scans);
  }, [setRecentScans]);

  const triggerSync = useCallback(async () => {
    if (!user || sync_in_progress.current) return;
    sync_in_progress.current = true;
    try {
      const result = await syncScans(user.id);
      if (result) {
        if (result.latest_prices.length > 0) {
          setCachedPrices(result.latest_prices);
        }
        await refreshLocalScans();
      }
    } catch {
      // Sync failed silently — will retry on next trigger
    } finally {
      sync_in_progress.current = false;
    }
  }, [user, setCachedPrices, refreshLocalScans]);

  return { triggerSync, refreshLocalScans };
}
