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
  DEMO_SALES_DELIVERIES,
  DEMO_SALES_REQUESTS,
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
import { fetchMaterials } from "../services/materials";
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

// ── Sales report (recycling hub) ────────────────────────────────────
const REPORT_MONTHS = 6;

export interface SalesMonthlyPoint {
  month: string;
  requestedKg: number;
  deliveredKg: number;
  revenueNaira: number;
}

export interface SalesByMaterial {
  name: string;
  valueNaira: number;
  kg: number;
}

export interface SalesDemandRow {
  name: string;
  requestedKg: number;
  fulfilledKg: number;
}

export interface RecentSale {
  id: string;
  material: string;
  weightKg: number;
  unitPriceNaira: number;
  valueNaira: number;
  settledAt: string;
}

export interface SalesReportData {
  kpis: {
    grossSales: number;
    kgTraded: number;
    deliveries: number;
    openRequests: number;
    trendPct: number | null;
  };
  monthly: SalesMonthlyPoint[];
  byMaterial: SalesByMaterial[];
  demand: SalesDemandRow[];
  recent: RecentSale[];
}

/** Pure derivation from hub API payloads → sales report view-model. Exported for tests. */
export function deriveSalesReport(
  deliveries: HubDelivery[],
  requests: HubRequest[],
  materials: MaterialCategoryInfo[],
): SalesReportData {
  const nameById = new Map(materials.map((m) => [m.id, m.name]));

  const now = new Date();
  const bucketMonths: Array<{ key: string; label: string }> = Array.from(
    { length: REPORT_MONTHS },
    (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (REPORT_MONTHS - 1 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }) };
    },
  );
  const monthly: SalesMonthlyPoint[] = bucketMonths.map((b) => ({
    month: b.label,
    requestedKg: 0,
    deliveredKg: 0,
    revenueNaira: 0,
  }));

  const bucketFor = (iso?: string | null): SalesMonthlyPoint | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const idx = bucketMonths.findIndex((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    return idx >= 0 ? monthly[idx] : null;
  };

  for (const r of requests) {
    const b = bucketFor(r.created_at ?? r.requested_on);
    if (b) b.requestedKg += Number(r.requested_kg) || 0;
  }
  for (const d of deliveries) {
    const b = bucketFor(d.delivered_at ?? d.created_at);
    if (b) {
      b.deliveredKg += Number(d.weight_kg) || 0;
      b.revenueNaira += Number(d.hub_price_naira) || 0;
    }
  }

  const grossSales = deliveries.reduce((a, d) => a + (Number(d.hub_price_naira) || 0), 0);
  const kgTraded = deliveries.reduce((a, d) => a + (Number(d.weight_kg) || 0), 0);
  const openRequests = requests.filter((r) => Number(r.fulfilled_kg) < Number(r.requested_kg)).length;

  const prevRevenue = monthly[REPORT_MONTHS - 2]?.revenueNaira ?? 0;
  const curRevenue = monthly[REPORT_MONTHS - 1]?.revenueNaira ?? 0;
  const trendPct = prevRevenue > 0 ? ((curRevenue - prevRevenue) / prevRevenue) * 100 : null;

  const byMat = new Map<number, { kg: number; value: number }>();
  for (const d of deliveries) {
    const agg = byMat.get(d.material_category_id) ?? { kg: 0, value: 0 };
    agg.kg += Number(d.weight_kg) || 0;
    agg.value += Number(d.hub_price_naira) || 0;
    byMat.set(d.material_category_id, agg);
  }
  const byMaterial: SalesByMaterial[] = [...byMat.entries()]
    .map(([id, v]) => ({ name: nameById.get(id) ?? `Material ${id}`, valueNaira: v.value, kg: v.kg }))
    .sort((a, b) => b.valueNaira - a.valueNaira);

  const dem = new Map<number, { req: number; ful: number }>();
  for (const r of requests) {
    const agg = dem.get(r.material_category_id) ?? { req: 0, ful: 0 };
    agg.req += Number(r.requested_kg) || 0;
    agg.ful += Number(r.fulfilled_kg) || 0;
    dem.set(r.material_category_id, agg);
  }
  const demand: SalesDemandRow[] = [...dem.entries()]
    .map(([id, v]) => ({ name: nameById.get(id) ?? `Material ${id}`, requestedKg: v.req, fulfilledKg: v.ful }))
    .sort((a, b) => b.requestedKg - a.requestedKg);

  const settledAtOf = (d: HubDelivery) => new Date(d.delivered_at ?? d.created_at ?? 0).getTime();
  const recent: RecentSale[] = [...deliveries]
    .sort((a, b) => settledAtOf(b) - settledAtOf(a))
    .slice(0, 6)
    .map((d) => {
      const weight = Number(d.weight_kg) || 0;
      const value = Number(d.hub_price_naira) || 0;
      return {
        id: d.id,
        material: nameById.get(d.material_category_id) ?? `Material ${d.material_category_id}`,
        weightKg: weight,
        unitPriceNaira: weight > 0 ? Math.round(value / weight) : 0,
        valueNaira: value,
        settledAt: d.delivered_at ?? d.created_at ?? "",
      };
    });

  return {
    kpis: { grossSales, kgTraded, deliveries: deliveries.length, openRequests, trendPct },
    monthly,
    byMaterial,
    demand,
    recent,
  };
}

export function useSalesReportData(): HookResult<SalesReportData> {
  return useLoad(
    async () => {
      const [deliveries, requests, materials] = await Promise.all([
        fetchMyHubDeliveries(),
        fetchMyHubRequests(),
        fetchMaterials(),
      ]);
      return deriveSalesReport(deliveries, requests, materials);
    },
    () => deriveSalesReport(DEMO_SALES_DELIVERIES, DEMO_SALES_REQUESTS, DEMO_MATERIALS),
  );
}