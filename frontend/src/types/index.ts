export interface ScrapScan {
  id: string;
  user_id: string;
  material_class: string;
  sub_grade?: string;
  weight_est_kg?: number;
  estimated_naira_value: number;
  confidence_score: number;
  toxicity_hazards?: string[];
  safety_instructions?: string;
  captured_at: string;
  synced_at?: string;
  is_synced: boolean;
  is_deleted: boolean;
  listing_id?: string;
  /** Server listing lifecycle: active, matched, scheduled, completed, … */
  listing_status?: string;
}

export interface PriceMatrixEntry {
  material_class: string;
  price_per_kg_naira: number;
  last_updated?: string;
}

export interface SyncResponse {
  status: string;
  synced_ids: string[];
  latest_prices: PriceMatrixEntry[];
  server_time: string;
}

export interface User {
  id: string;
  phone_number: string;
  full_name?: string;
  location_hub: string;
  address_text?: string;
  role: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at?: string;
  listings_this_week?: number;
  listings_week_start?: string;
  created_at?: string;
}

export interface VisionCandidate {
  material_class: string;
  material_slug: string;
  confidence: number;
}

export interface VisionAnalysis {
  material_class: string;
  material_slug: string;
  confidence: number;
  toxicity_hazards: string[];
  safety_instructions: string;
  hazard_level: HazardLevel;
  source: "clip" | "onnx" | "server" | "heuristic" | "manual";
  /**
   * True when the classifier is not confident enough to be presented as a firm
   * answer (low top-1 score, two classes too close, or a diffuse distribution).
   * The UI must ask the user to confirm instead of silently trading on a guess.
   */
  uncertain?: boolean;
  /** Top candidates to offer for confirmation, present when `uncertain` is true. */
  candidates?: VisionCandidate[];
}

export interface MaterialCategoryInfo {
  id: number;
  slug: string;
  name: string;
  name_ha?: string;
  name_pcm?: string;
  price_per_kg_naira: number;
  carbon_kg_co2e_per_kg?: number;
  is_hazardous: boolean;
  price_last_updated_at?: string | null;
  price_source?: "seed" | "admin" | "hub_feed" | "market_feed" | "manual" | string;
  price_version?: number;
  is_stale?: boolean;
}

/** Result of probing whether a verified on-device classifier is available. */
export interface VisionModelStatus {
  available: boolean;
  verified: boolean;
  reason:
    | "verified"
    | "model_missing"
    | "class_mismatch"
    | "load_error"
    | "not_probed";
  modelUrl: string;
  classCount: number | null;
  message: string;
}

export type HazardLevel = "low" | "medium" | "high" | "critical";

export type Language = "en" | "ha" | "pcm" | "yo" | "ig";

export type Theme = "light" | "dark";

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
  status: string;
  expires_at?: string;
  listings_this_week: number;
  weekly_limit: number;
  max_weight_kg: number | null;
}

export interface SubscriptionPurchaseRequest {
  plan: string;
  payment_method: string;
  payment_reference?: string;
}