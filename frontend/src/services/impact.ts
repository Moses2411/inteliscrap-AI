import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface ImpactSummary {
  total_tonnage_kg: number;
  total_carbon_offset_kg_co2e: number;
  total_collector_income_naira: number;
  transactions_count: number;
  total_transactions?: number;
  computed_from?: "settlements" | "ngo_impact_logs" | "demo";
  platform_revenue_naira?: number;
  seller_payout_naira?: number;
}

export interface ImpactDailyPoint {
  period: string;
  tonnage_kg: number;
  carbon_offset_kg_co2e: number;
  collector_income_naira: number;
}

export interface ImpactByMaterial {
  material: string;
  tonnage_kg: number;
  carbon_offset_kg_co2e: number;
  collector_income_naira?: number;
}

export async function fetchImpactSummary(): Promise<ImpactSummary> {
  const res = await fetch(`${API_BASE}/api/v1/impact/summary`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load impact summary");
  return res.json();
}

export async function fetchImpactDaily(): Promise<ImpactDailyPoint[]> {
  const res = await fetch(`${API_BASE}/api/v1/impact/daily`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load daily impact");
  return res.json();
}

export async function fetchImpactByMaterial(): Promise<ImpactByMaterial[]> {
  const res = await fetch(`${API_BASE}/api/v1/impact/by-material`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load material breakdown");
  return res.json();
}

/** Network-wide operational snapshot (active jobs / offers / value). */
export interface ImpactOps {
  active_jobs: number;
  available_offers: number;
  jobs_value_naira: number;
  offers_value_naira: number;
}

export async function fetchImpactOps(): Promise<ImpactOps> {
  const res = await fetch(`${API_BASE}/api/v1/impact/ops`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load operations overview");
  return res.json();
}