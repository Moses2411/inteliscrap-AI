import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface SubscriptionPlan {
  plan: string;
  name: string;
  price_naira: number;
  cycle: string;
  features: string[];
  limits: {
    weekly_listings: number;
    max_weight_kg: number | null;
  };
}

export interface SubscriptionStatus {
  plan: string;
  plan_name?: string;
  status: string;
  expires_at?: string;
  listings_this_week: number;
  weekly_limit: number;
  max_weight_kg: number | null;
  /** Premium EPR/NGO entitlement — network data access. */
  data_access?: boolean;
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

export async function checkListingEligibility(): Promise<CheckListingEligibilityResponse> {
  const res = await fetch(`${API_BASE}/api/v1/subscription/check-listing`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to check eligibility");
  return res.json();
}

// ── Premium plans (role-specific, yearly) ───────────────────────────
// Server-owned prices mirrored here purely for display. The amount that is
// actually charged is fixed by the backend when checkout starts.
export type PremiumPlanKey = "seller_yearly" | "ngo_yearly" | "epr_yearly";

export interface PremiumPlanInfo {
  plan: PremiumPlanKey;
  name: string;
  priceNaira: number;
  blurb: string;
  features: string[];
  entitlement: string;
}

export const PREMIUM_BY_ROLE: Record<string, PremiumPlanInfo> = {
  seller: {
    plan: "seller_yearly",
    name: "Seller Premium",
    priceNaira: 4900,
    blurb: "Unlimited listings for a full year.",
    features: [
      "Unlimited listings all year",
      "Unlimited quantity per listing",
      "Priority in collector matching",
      "Priority support",
    ],
    entitlement: "unlimited",
  },
  collector: {
    plan: "seller_yearly",
    name: "Seller Premium",
    priceNaira: 4900,
    blurb: "Unlimited listings for a full year.",
    features: [
      "Unlimited listings all year",
      "Unlimited quantity per listing",
      "Priority in collector matching",
      "Priority support",
    ],
    entitlement: "unlimited",
  },
  ngo: {
    plan: "ngo_yearly",
    name: "NGO Premium",
    priceNaira: 49000,
    blurb: "Full network impact data for a full year.",
    features: [
      "Full network impact data",
      "Tonnage, carbon & income analytics",
      "Daily and by-material breakdowns",
      "Priority support",
    ],
    entitlement: "data access",
  },
  partner: {
    plan: "epr_yearly",
    name: "EPR Premium",
    priceNaira: 99000,
    blurb: "Network-wide EPR compliance data for a full year.",
    features: [
      "Network-wide EPR compliance manifest",
      "Auditable settled-collection export",
      "JSON export for regulators",
      "Priority support",
    ],
    entitlement: "data access",
  },
};

export function premiumPlanForRole(role: string | null | undefined): PremiumPlanInfo | null {
  if (!role) return null;
  return PREMIUM_BY_ROLE[role] ?? null;
}

/** Roles that can buy a premium plan (data or listings entitlement). */
export function canSubscribe(role: string | null | undefined): boolean {
  return premiumPlanForRole(role) !== null;
}