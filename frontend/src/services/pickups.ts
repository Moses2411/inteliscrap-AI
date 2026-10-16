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
  // Proof-of-handover state.
  confirm_deadline?: string;
  confirmed_at?: string;
  disputed_at?: string;
  dispute_reason?: string;
  handover_weight_kg?: number;
  awaiting_confirmation?: boolean;
}

/** The collector's accept/regenerate response carries the one-time PIN. */
export interface AcceptedPickup extends PickupJob {
  handover_pin: string;
}

export interface HoldStatus {
  on_hold: boolean;
  open_handovers: number;
}

export interface DisputeItem extends PickupJob {
  seller_id: string;
  collector_id?: string;
  seller_phone?: string;
  collector_phone?: string;
}

export interface ConfirmedTransaction {
  id: string;
  status: string;
  weight_kg: number;
  gross_value_naira: number;
}

async function requireCollector(): Promise<void> {
  if (getRole() !== "collector") throw new Error("Collector access required");
}

/** Persist the collector's handover PIN so it survives a page reload. */
export function storeHandoverPin(pickupId: string, pin: string): void {
  try {
    localStorage.setItem(`handover_pin_${pickupId}`, pin);
  } catch {
    // storage unavailable — the PIN is still shown for the session.
  }
}

export function readStoredHandoverPin(pickupId: string): string | null {
  try {
    return localStorage.getItem(`handover_pin_${pickupId}`);
  } catch {
    return null;
  }
}

function messageFromBody(body: unknown): string | null {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return null;
}

async function fail(res: Response, fallback: string): Promise<never> {
  let detail: string | null = null;
  try {
    detail = messageFromBody(await res.json());
  } catch {
    detail = null;
  }
  if (res.status === 403) {
    const role = await syncRoleFromServer();
    throw new Error(detail ?? `Not allowed — your account role is "${role ?? "unknown"}".`);
  }
  throw new Error(detail ?? `${fallback}: ${res.statusText}`);
}

export async function fetchOffers(): Promise<PickupOffer[]> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/offers`, { headers: authHeaders() });
  if (!res.ok) await fail(res, "Failed to load offers");
  return res.json();
}

export async function fetchHoldStatus(): Promise<HoldStatus> {
  const res = await fetch(`${API_BASE}/api/v1/pickups/hold`, { headers: authHeaders() });
  if (!res.ok) await fail(res, "Failed to load hold status");
  return res.json();
}

export async function acceptOffer(pickupId: string): Promise<AcceptedPickup> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/${pickupId}/accept`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await fail(res, "Accept failed");
  return res.json();
}

export async function regeneratePin(pickupId: string): Promise<AcceptedPickup> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/${pickupId}/pin`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) await fail(res, "Could not issue a PIN");
  return res.json();
}

export async function recordHandover(
  pickupId: string,
  weightKg: number,
): Promise<PickupJob> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/${pickupId}/handover`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ weight_kg: weightKg }),
  });
  if (!res.ok) await fail(res, "Could not record handover");
  return res.json();
}

export async function fetchActivePickups(): Promise<PickupJob[]> {
  await requireCollector();
  const res = await fetch(`${API_BASE}/api/v1/pickups/active`, { headers: authHeaders() });
  if (!res.ok) await fail(res, "Failed to load pickups");
  return res.json();
}

/** Sellers (households): open handovers on their own listings. */
export async function fetchAwaitingConfirmation(): Promise<PickupJob[]> {
  const res = await fetch(`${API_BASE}/api/v1/pickups/awaiting-confirmation`, {
    headers: authHeaders(),
  });
  if (!res.ok) await fail(res, "Failed to load confirmations");
  return res.json();
}

export async function confirmHandover(
  pickupId: string,
  pin: string,
): Promise<ConfirmedTransaction> {
  const res = await fetch(`${API_BASE}/api/v1/pickups/${pickupId}/confirm`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) await fail(res, "Confirmation failed");
  return res.json();
}

/** Admin: handovers that were never confirmed in time. */
export async function fetchDisputes(): Promise<DisputeItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/admin/disputes`, { headers: authHeaders() });
  if (!res.ok) await fail(res, "Failed to load disputes");
  return res.json();
}

export async function resolveDispute(
  pickupId: string,
  resolution: "confirm" | "cancel",
  reason?: string,
): Promise<{ pickup_id: string; pickup_status: string; transaction_id?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/pickups/${pickupId}/resolve`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ resolution, reason }),
  });
  if (!res.ok) await fail(res, "Could not resolve dispute");
  return res.json();
}
