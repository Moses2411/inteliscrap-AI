import { authHeaders } from "./auth";
import type { SubscriptionStatus } from "./subscription";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type PaymentPurpose = "user_subscription" | "hub_subscription";

export interface MomoConfig {
  enabled: boolean;
  environment: string;
  currency: string;
  callback_configured: boolean;
}

export interface MomoCheckoutRequest {
  plan: string;
  phone_number: string;
  purpose: PaymentPurpose;
}

export interface MomoCheckout {
  reference_id: string;
  status: string;
  purpose: string;
  plan: string;
  amount: number;
  currency: string;
  payer_msisdn: string;
  message: string;
}

export type PaymentState = "pending" | "successful" | "failed" | "cancelled";

export interface PaymentStatus {
  reference_id: string;
  status: PaymentState;
  purpose: string;
  plan: string;
  amount: number;
  currency: string;
  payer_msisdn: string;
  provider_status?: string | null;
  provider_financial_tx_id?: string | null;
  failure_reason?: string | null;
  applied: boolean;
  completed_at?: string | null;
  subscription?: SubscriptionStatus | null;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

async function parseError(res: Response, fallback: string): Promise<PaymentError> {
  let detail = fallback;
  try {
    const data = (await res.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail.trim()) detail = data.detail;
  } catch {
    /* keep fallback */
  }
  return new PaymentError(detail, res.status);
}

export async function fetchMomoConfig(): Promise<MomoConfig> {
  const res = await fetch(`${API_BASE}/api/v1/payments/momo/config`);
  if (!res.ok) throw new PaymentError("Could not load payment settings", res.status);
  return res.json();
}

export async function startMomoCheckout(request: MomoCheckoutRequest): Promise<MomoCheckout> {
  const res = await fetch(`${API_BASE}/api/v1/payments/momo/checkout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(request),
  });
  if (!res.ok) throw await parseError(res, "Could not start the payment");
  return res.json();
}

export async function fetchPaymentStatus(referenceId: string): Promise<PaymentStatus> {
  const res = await fetch(`${API_BASE}/api/v1/payments/${referenceId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Could not read the payment status");
  return res.json();
}

/** Ask the server to poll MoMo directly (used when callbacks aren't reachable). */
export async function refreshPaymentStatus(referenceId: string): Promise<PaymentStatus> {
  const res = await fetch(`${API_BASE}/api/v1/payments/${referenceId}/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw await parseError(res, "Could not refresh the payment status");
  return res.json();
}
