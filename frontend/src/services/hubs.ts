import { authHeaders } from "./auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface HubInfo {
  id: string;
  owner_user_id: string;
  name: string;
  address_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city: string;
  contact_phone?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface HubRequest {
  id: string;
  hub_id: string;
  hub_name: string;
  material_category_id: number;
  material_name: string;
  requested_kg: number;
  fulfilled_kg: number;
  note?: string | null;
  requested_on: string;
  status: string;
  created_at?: string | null;
}

export interface HubDelivery {
  id: string;
  hub_id: string;
  request_id: string;
  transaction_id: string;
  material_category_id: number;
  weight_kg: number;
  hub_price_naira: number;
  delivered_at?: string | null;
  created_at?: string | null;
}

export interface HubSubscription {
  id: string;
  hub_id: string;
  plan_name: string;
  amount_naira: number;
  cycle: string;
  started_at?: string | null;
  next_billing_at?: string | null;
  status: string;
  created_at?: string | null;
}

export async function listHubs(): Promise<HubInfo[]> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/`);
  if (!res.ok) throw new Error("Failed to load hubs");
  return res.json();
}

export async function fetchMyHub(): Promise<HubInfo> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("No hub registered");
  return res.json();
}

export async function fetchMyHubRequests(): Promise<HubRequest[]> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/requests`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load hub requests");
  return res.json();
}

export async function fetchMyHubDeliveries(): Promise<HubDelivery[]> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/deliveries`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load deliveries");
  return res.json();
}

export async function fetchMyHubSubscriptions(): Promise<HubSubscription[]> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/subscriptions`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load subscriptions");
  return res.json();
}

export interface CreateHubRequestPayload {
  material_category_id: number;
  requested_kg: number;
  requested_on: string; // ISO
  note?: string;
}

export async function createHubRequest(payload: CreateHubRequestPayload): Promise<HubRequest> {
  const res = await fetch(`${API_BASE}/api/v1/hubs/requests`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create request");
  return res.json();
}