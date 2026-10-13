import type { HazardLevel, Language } from "./index";

/** Local inference backend reported by the edge engine. */
export type EngineBackend = "webgpu" | "wasm" | "cpu";

/** Lifecycle state of the on-device LLM / vision engine. */
export type EngineState = "ready" | "initializing" | "error" | "unavailable";

export interface EngineStatus {
  name: string;
  version: string;
  status: EngineState;
  backend: EngineBackend;
}

export interface NetworkStatus {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/** A single normalized bounding box drawn over the viewfinder. */
export interface BoundingBox {
  /** Normalized 0..1 coordinates relative to the video frame. */
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

/** Row shape used by the offline scan-history table. */
export interface ScanRecord {
  id: string;
  materialClass: string;
  materialSlug: string;
  subGrade?: string;
  confidence: number;
  weightKg: number;
  valueNgn: number;
  hazardLevel: HazardLevel;
  hazards: string[];
  synced: boolean;
  capturedAt: string;
}

export interface MarketTrend {
  sparkline: number[];
  change24h: number;
}

export interface SafetyGuidance {
  materialSlug: string;
  hazardLevel: HazardLevel;
  hazards: string[];
  headline: string;
  instructions: string[];
}

export type Currency = "NGN" | "USD";
export type WeightUnit = "kg" | "lb";
export type VoiceStatus = "idle" | "speaking" | "paused";
export type HistoryFilter = "all" | "synced" | "pending";

export interface VoiceSettings {
  language: Language;
  volume: number;
}

export interface SyncSnapshot {
  pending: number;
  synced: number;
  isSyncing: boolean;
  lastSyncAt?: string;
}
