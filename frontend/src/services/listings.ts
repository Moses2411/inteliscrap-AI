import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface CreateListingPayload {
  material_category_id: number;
  title?: string;
  estimated_weight_kg?: number;
  estimated_value_naira?: number;
  confidence_score?: number;
  toxicity_hazards?: string[];
  latitude?: number;
  longitude?: number;
  address_text?: string;
  auto_dispatch?: boolean;
}

export async function createListing(
  payload: CreateListingPayload,
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/v1/listings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Listing creation failed: ${res.statusText}`);
  return res.json();
}
