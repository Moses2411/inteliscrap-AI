const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const KEY_STORAGE = "inteliscrap_partner_key";

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
  total_transactions: number;
  total_tonnage_kg: number;
  total_carbon_offset_kg_co2e: number;
  total_collector_income_naira: number;
  items: ManifestoItem[];
}

export function getPartnerApiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE);
}

export function setPartnerApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key);
}

export async function fetchManifesto(
  dateFrom?: string,
  dateTo?: string,
): Promise<ComplianceManifesto> {
  const key = getPartnerApiKey();
  if (!key) throw new Error("Compliance API key required");
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${API_BASE}/api/v1/compliance/manifesto${qs}`, {
    headers: { "X-API-Key": key },
  });
  if (!res.ok) throw new Error("Failed to load compliance manifesto");
  return res.json();
}