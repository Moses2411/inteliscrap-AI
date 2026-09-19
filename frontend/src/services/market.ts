import type { MaterialCategoryInfo } from "../types";
import { fetchMaterials } from "./materials";
import type { HubInfo } from "./hubs";
import { listHubs } from "./hubs";

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
}

export async function fetchListings(): Promise<MarketplaceListing[]> {
  const res = await fetch(`${API_BASE}/api/v1/listings`);
  if (!res.ok) throw new Error("Failed to load listings");
  return res.json();
}

/** Public market snapshot: price guide + active listings + active hubs. */
export async function fetchMarketData(): Promise<MarketData> {
  // materials() has its own cache; tolerate partial failures per-source
  const [materials, listings, hubs] = await Promise.allSettled([
    fetchMaterials(),
    fetchListings(),
    listHubs(),
  ]);
  return {
    materials: materials.status === "fulfilled" ? materials.value : [],
    listings: listings.status === "fulfilled" ? listings.value : [],
    hubs: hubs.status === "fulfilled" ? hubs.value : [],
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