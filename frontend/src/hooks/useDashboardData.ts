import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEMO_COMPLIANCE,
  DEMO_HUB,
  DEMO_HUB_DELIVERIES,
  DEMO_HUB_REQUESTS,
  DEMO_HUB_SUBSCRIPTIONS,
  DEMO_IMPACT_BY_MATERIAL,
  DEMO_IMPACT_DAILY,
  DEMO_IMPACT_SUMMARY,
  DEMO_LISTINGS,
  DEMO_MATERIALS,
  previewEnabled,
} from "../lib/demoData";
import {
  fetchImpactByMaterial,
  fetchImpactDaily,
  fetchImpactSummary,
  type ImpactByMaterial,
  type ImpactDailyPoint,
  type ImpactSummary,
} from "../services/impact";
import {
  fetchMyHub,
  fetchMyHubDeliveries,
  fetchMyHubRequests,
  fetchMyHubSubscriptions,
  type HubDelivery,
  type HubInfo,
  type HubRequest,
  type HubSubscription,
} from "../services/hubs";
import { fetchMarketData, type MarketplaceListing, type MarketData } from "../services/market";
import { fetchManifesto, getPartnerApiKey, type ComplianceManifesto } from "../services/compliance";
import type { MaterialCategoryInfo } from "../types";

interface HookResult<T> {
  data: T | null;
  loading: boolean;
  isPreview: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load once per tick. Falls back to clearly-labelled preview data when the
 * API is unreachable and preview mode is enabled.
 */
function useLoad<T>(loader: () => Promise<T>, demo: () => T): HookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loaderRef = useRef(loader);
  const demoRef = useRef(demo);
  loaderRef.current = loader;
  demoRef.current = demo;

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const value = await loaderRef.current();
        if (!cancelled) {
          setData(value);
          setPreview(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (previewEnabled()) {
          setData(demoRef.current());
          setPreview(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, isPreview, error, refresh };
}

// ── Market (price guide + listings + demand hubs) ───────────────────
export function useMarketData(): HookResult<MarketData> {
  return useLoad(fetchMarketData, () => ({
    materials: DEMO_MATERIALS as MaterialCategoryInfo[],
    listings: DEMO_LISTINGS as MarketplaceListing[],
    hubs: [DEMO_HUB],
  }));
}

// ── Impact (NGO / admin) ────────────────────────────────────────────
export interface ImpactBundle {
  summary: ImpactSummary | null;
  daily: ImpactDailyPoint[];
  byMaterial: ImpactByMaterial[];
}

export function useImpactData(): HookResult<ImpactBundle> {
  return useLoad(
    async () => {
      const [summary, daily, byMaterial] = await Promise.all([
        fetchImpactSummary(),
        fetchImpactDaily(),
        fetchImpactByMaterial(),
      ]);
      return { summary, daily, byMaterial };
    },
    () => ({
      summary: DEMO_IMPACT_SUMMARY,
      daily: DEMO_IMPACT_DAILY,
      byMaterial: DEMO_IMPACT_BY_MATERIAL,
    }),
  );
}

// ── Recycling hub desk ──────────────────────────────────────────────
export interface HubBundle {
  hub: HubInfo | null;
  requests: HubRequest[];
  deliveries: HubDelivery[];
  subscriptions: HubSubscription[];
}

export function useHubData(): HookResult<HubBundle> {
  return useLoad(
    async () => {
      const [hub, requests, deliveries, subscriptions] = await Promise.all([
        fetchMyHub(),
        fetchMyHubRequests(),
        fetchMyHubDeliveries(),
        fetchMyHubSubscriptions(),
      ]);
      return { hub, requests, deliveries, subscriptions };
    },
    () => ({
      hub: DEMO_HUB,
      requests: DEMO_HUB_REQUESTS,
      deliveries: DEMO_HUB_DELIVERIES,
      subscriptions: DEMO_HUB_SUBSCRIPTIONS,
    }),
  );
}

// ── Compliance manifesto (partner / PRO / admin) ────────────────────
export function useComplianceData(): HookResult<ComplianceManifesto> {
  return useLoad(
    async () => {
      if (!getPartnerApiKey()) throw new Error("Set your compliance API key");
      return fetchManifesto();
    },
    () => DEMO_COMPLIANCE,
  );
}