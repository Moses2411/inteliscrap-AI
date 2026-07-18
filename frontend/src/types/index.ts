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
  created_at?: string;
}

export interface GemmaAnalysis {
  material_class: string;
  confidence: number;
  toxicity_hazards: string[];
  safety_instructions: string;
}

export type HazardLevel = "low" | "medium" | "high" | "critical";

export type Language = "ha" | "pcm";
