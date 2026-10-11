import { authHeaders } from "./auth";
import { checkListingEligibility } from "./subscription";

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
  contact_phone?: string;
  auto_dispatch?: boolean;
}

export interface ListingEligibility {
  allowed: boolean;
  error?: string;
}

export async function checkListingAllowed(estimatedWeightKg?: number): Promise<ListingEligibility> {
  try {
    const result = await checkListingEligibility(estimatedWeightKg);
    return { allowed: result.allowed, error: result.error };
  } catch {
    // If check fails, allow but log warning
    console.warn("Could not check listing eligibility, proceeding");
    return { allowed: true };
  }
}

export async function createListing(
  payload: CreateListingPayload,
): Promise<{ id: string; status: string }> {
  // Check subscription eligibility first
  const eligibility = await checkListingAllowed(payload.estimated_weight_kg);
  if (!eligibility.allowed) {
    throw new Error(eligibility.error || "Listing not allowed due to subscription limits");
  }

  const res = await fetch(`${API_BASE}/api/v1/listings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Listing creation failed: ${res.statusText}`);
  return res.json();
}