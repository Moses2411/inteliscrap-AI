import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface ManifestoItem {
  transaction_id: string;
  collector_id: string;
  collector_phone: string;
  material_slug: string;
  material_name: string;
  weight_kg: number;
  gross_value_naira: number;
  carbon_offset_kg_co2e: number;
  hub?: string | null;
  settled_at?: string | null;
}

export interface ComplianceManifesto {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  generated_at: string;
  scope?: string;
  total_transactions: number;
  total_tonnage_kg: number;
  total_carbon_offset_kg_co2e: number;
  total_collector_income_naira: number;
  items: ManifestoItem[];
}

/** Thrown when the caller's premium subscription is missing/expired. */
export class PremiumRequiredError extends Error {
  constructor() {
    super("An active premium subscription is required to access this data.");
    this.name = "PremiumRequiredError";
  }
}

export async function fetchManifesto(
  dateFrom?: string,
  dateTo?: string,
): Promise<ComplianceManifesto> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString() ? `?${params.toString()}` : "";

  // Subscription-gated: the session token carries access, there is no API key.
  const res = await fetch(`${API_BASE}/api/v1/compliance/manifesto${qs}`, {
    headers: authHeaders(),
  });
  if (res.status === 402) throw new PremiumRequiredError();
  if (!res.ok) throw new Error("Failed to load compliance manifesto");
  return res.json();
}
