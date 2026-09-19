import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface ImpactSummary {
  total_tonnage_kg: number;
  total_carbon_offset_kg_co2e: number;
  total_collector_income_naira: number;
  transactions_count: number;
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