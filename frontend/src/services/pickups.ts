import { authHeaders, getRole, syncRoleFromServer } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface PickupOffer {
  pickup_id: string;
  listing_id: string;
  material_name: string;
  material_slug: string;
  estimated_weight_kg?: number;
  estimated_value_naira?: number;
  toxicity_hazards?: string[];
  address_text?: string;
  distance_m?: number;
  created_at?: string;
}

export interface PickupJob extends PickupOffer {
  status: string;
  contact_phone?: string;
  latitude?: number;
  longitude?: number;
  accepted_at?: string;
}

async function requireCollector(): Promise<void> {
  if (getRole() !== "collector") throw new Error("Collector access required");
}

async function toJson(res: Response, fallback: string): Promise<never> {
  if (res.status === 403) {
    const role = await syncRoleFromServer();
    throw new Error(
      `Collector access required — your account role is "${role ?? "unknown"}". Switch workspace in Settings.`,
    );
  }
  throw new Error(`${fallback}: ${res.statusText}`);
}

export async function fetchOffers(): Promise<PickupOffer[]> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/offers`, { headers: authHeaders() });
  if (!res.ok) await toJson(res, "Failed to load offers");
  return res.json();
}

export async function acceptOffer(pickupId: string): Promise<PickupJob> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/${pickupId}/accept`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await toJson(res, "Accept failed");
  return res.json();
}

export async function fetchActivePickups(): Promise<PickupJob[]> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/active`, { headers: authHeaders() });
  if (!res.ok) await toJson(res, "Failed to load pickups");
  return res.json();
}