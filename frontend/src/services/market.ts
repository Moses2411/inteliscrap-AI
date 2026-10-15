import type { MaterialCategoryInfo } from "../types";
import { authHeaders, getRole, getToken } from "./auth";
import { fetchMaterials } from "./materials";
import type { HubInfo, HubRequest } from "./hubs";
import { fetchHubRequests, listHubs } from "./hubs";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  material_category_id: number;
  title?: string | null;
  description?: string | null;
  photo_url?: string | null;
  thumbnail_url?: string | null;
  estimated_weight_kg?: number | null;
  actual_weight_kg?: number | null;
  estimated_value_naira?: number | null;
  final_value_naira?: number | null;
  confidence_score: number;
  toxicity_hazards?: unknown;
  latitude?: number | null;
  longitude?: number | null;
  address_text?: string | null;
  contact_phone?: string | null;
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
}

export interface MarketData {
  materials: MaterialCategoryInfo[];
  listings: MarketplaceListing[];
  hubs: HubInfo[];
  hubRequests: HubRequest[];
}

export async function fetchListings(): Promise<MarketplaceListing[]> {
  const res = await fetch(`${API_BASE}/api/v1/listings`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load listings");
  return res.json();
}

/** The signed-in user's own listings — the only board a household/seller sees. */
export async function fetchMyListings(): Promise<MarketplaceListing[]> {
  const res = await fetch(`${API_BASE}/api/v1/listings/mine`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load your listings");
  return res.json();
}

/**
 * Public market snapshot: price guide + listings + active hubs + hub demand.
 *
 * Listings are collector-only (the market board is where they accept work), so
 * households get *their own* listings instead. Hub buy-requests are visible to
 * collectors and households. Each source degrades independently.
 */
export async function fetchMarketData(): Promise<MarketData> {
  const role = getRole();
  const loggedIn = getToken() != null;
  const isCollector = role === "collector";
  const seesHubDemand = role === "collector" || role === "seller";

  const [materials, listings, hubs, hubRequests] = await Promise.allSettled([
    fetchMaterials(),
    isCollector ? fetchListings() : loggedIn ? fetchMyListings() : Promise.resolve([]),
    listHubs(),
    loggedIn && seesHubDemand ? fetchHubRequests() : Promise.resolve([]),
  ]);
  return {
    materials: materials.status === "fulfilled" ? materials.value : [],
    listings: listings.status === "fulfilled" ? listings.value : [],
    hubs: hubs.status === "fulfilled" ? hubs.value : [],
    hubRequests: hubRequests.status === "fulfilled" ? hubRequests.value : [],
  };
}

export function materialNameById(
  materials: MaterialCategoryInfo[],
  id: number,
): string | undefined {
  return materials.find((m) => m.id === id)?.name;
}

export function materialBySlug(
  materials: MaterialCategoryInfo[],
  slug: string,
): MaterialCategoryInfo | undefined {
  return materials.find((m) => m.slug === slug);
}