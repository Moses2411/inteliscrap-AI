import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface SubscriptionPlan {
  plan: string;
  name: string;
  price_naira: number;
  cycle: string;
  features: string[];
  limits: {
    daily_listings: number;
    max_weight_kg: number | null;
  };
}

export interface SubscriptionStatus {
  plan: string;
  status: string;
  expires_at?: string;
  listings_today: number;
  daily_limit: number;
  max_weight_kg: number | null;
}

export interface SubscriptionPurchaseRequest {
  plan: string;
  payment_method: string;
  payment_reference?: string;
}

export interface CheckListingEligibilityResponse {
  allowed: boolean;
  error?: string;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/plans`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch subscription status");
  return res.json();
}

export async function purchaseSubscription(request: SubscriptionPurchaseRequest): Promise<SubscriptionStatus> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/purchase`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Purchase failed" }));
    throw new Error(data.detail || "Purchase failed");
  }
  return res.json();
}

export async function checkListingEligibility(estimatedWeightKg?: number): Promise<CheckListingEligibilityResponse> {
  const params = new URLSearchParams();
  if (estimatedWeightKg !== undefined) {
    params.set("estimated_weight_kg", String(estimatedWeightKg));
  }
  const res = await fetch(`${API_BASE}/api/v1/subscription/check-listing?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to check eligibility");
  return res.json();
}