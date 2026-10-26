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

export async function checkListingAllowed(): Promise<ListingEligibility> {
  try {
    const result = await checkListingEligibility();
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
  const eligibility = await checkListingAllowed();
  if (!eligibility.allowed) {
    throw new Error(eligibility.error || "Listing not allowed due to subscription limits");
  }

  const res = await fetch(`${API_BASE}/api/v1/listings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = `Listing creation failed: ${res.statusText}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  return res.json();
}

/**
 * Collector claims a listing straight from the market board ("Accept offer").
 * The listing becomes `scheduled` and shows up under "My jobs".
 */
export async function acceptListing(listingId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/listings/${listingId}/accept`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    let message = "Could not accept this offer — it may already be taken";
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") message = data.detail;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
}