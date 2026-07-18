import { createContext, useContext } from "react";
import type { GemmaAnalysis, PriceMatrixEntry, ScrapScan, User } from "../types";

export interface AppState {
  user: User | null;
  is_online: boolean;
  is_gemma_ready: boolean;
  gemma_progress: number;
  current_scan: GemmaAnalysis | null;
  recent_scans: ScrapScan[];
  cached_prices: PriceMatrixEntry[];
  selected_language: "ha" | "pcm";

  setUser: (user: User | null) => void;
  setOnline: (online: boolean) => void;
  setGemmaReady: (ready: boolean) => void;
  setGemmaProgress: (progress: number) => void;
  setCurrentScan: (scan: GemmaAnalysis | null) => void;
  setRecentScans: (scans: ScrapScan[]) => void;
  setCachedPrices: (prices: PriceMatrixEntry[]) => void;
  setSelectedLanguage: (lang: "ha" | "pcm") => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
