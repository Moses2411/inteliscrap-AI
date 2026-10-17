import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * The caller's own settled income. Populated the moment a handover PIN is
 * confirmed — the same settled transactions the admin impact and partner EPR
 * dashboards read.
 */
export interface MyEarnings {
  role: string;
  total_income_naira: number;
  last_30_days_naira: number;
  settled_transactions: number;
  total_weight_kg: number;
}

export async function fetchMyEarnings(): Promise<MyEarnings> {
  const res = await fetch(`${API_BASE}/api/v1/transactions/me/earnings`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load earnings");
  return res.json();
}
