import { createContext, useContext } from "react";
import type { VisionAnalysis, Language, PriceMatrixEntry, ScrapScan, User, Theme } from "../types";

export interface AppState {
  user: User | null;
  is_online: boolean;
  current_scan: VisionAnalysis | null;
  recent_scans: ScrapScan[];
  cached_prices: PriceMatrixEntry[];
  selected_language: Language;
  theme: Theme;

  setUser: (user: User | null) => void;
  setOnline: (online: boolean) => void;
  setCurrentScan: (scan: VisionAnalysis | null) => void;
  setRecentScans: (scans: ScrapScan[]) => void;
  setCachedPrices: (prices: PriceMatrixEntry[]) => void;
  setSelectedLanguage: (lang: Language) => void;
  toggleTheme: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
