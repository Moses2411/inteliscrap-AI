import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import type { GemmaAnalysis, PriceMatrixEntry, ScrapScan, User } from "../types";
import { AppContext, type AppState } from "./appStore";

type Action =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_ONLINE"; payload: boolean }
  | { type: "SET_GEMMA_READY"; payload: boolean }
  | { type: "SET_GEMMA_PROGRESS"; payload: number }
  | { type: "SET_CURRENT_SCAN"; payload: GemmaAnalysis | null }
  | { type: "SET_RECENT_SCANS"; payload: ScrapScan[] }
  | { type: "SET_CACHED_PRICES"; payload: PriceMatrixEntry[] }
  | { type: "SET_LANGUAGE"; payload: "ha" | "pcm" };

interface State {
  user: User | null;
  is_online: boolean;
  is_gemma_ready: boolean;
  gemma_progress: number;
  current_scan: GemmaAnalysis | null;
  recent_scans: ScrapScan[];
  cached_prices: PriceMatrixEntry[];
  selected_language: "ha" | "pcm";
}

const initialState: State = {
  user: null,
  is_online: navigator.onLine,
  is_gemma_ready: false,
  gemma_progress: 0,
  current_scan: null,
  recent_scans: [],
  cached_prices: [],
  selected_language: "ha",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_ONLINE":
      return { ...state, is_online: action.payload };
    case "SET_GEMMA_READY":
      return { ...state, is_gemma_ready: action.payload };
    case "SET_GEMMA_PROGRESS":
      return { ...state, gemma_progress: action.payload };
    case "SET_CURRENT_SCAN":
      return { ...state, current_scan: action.payload };
    case "SET_RECENT_SCANS":
      return { ...state, recent_scans: action.payload };
    case "SET_CACHED_PRICES":
      return { ...state, cached_prices: action.payload };
    case "SET_LANGUAGE":
      return { ...state, selected_language: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setUser = useCallback((user: User | null) => dispatch({ type: "SET_USER", payload: user }), []);
  const setOnline = useCallback((online: boolean) => dispatch({ type: "SET_ONLINE", payload: online }), []);
  const setGemmaReady = useCallback((ready: boolean) => dispatch({ type: "SET_GEMMA_READY", payload: ready }), []);
  const setGemmaProgress = useCallback((progress: number) => dispatch({ type: "SET_GEMMA_PROGRESS", payload: progress }), []);
  const setCurrentScan = useCallback((scan: GemmaAnalysis | null) => dispatch({ type: "SET_CURRENT_SCAN", payload: scan }), []);
  const setRecentScans = useCallback((scans: ScrapScan[]) => dispatch({ type: "SET_RECENT_SCANS", payload: scans }), []);
  const setCachedPrices = useCallback((prices: PriceMatrixEntry[]) => dispatch({ type: "SET_CACHED_PRICES", payload: prices }), []);
  const setSelectedLanguage = useCallback((lang: "ha" | "pcm") => dispatch({ type: "SET_LANGUAGE", payload: lang }), []);

  const value = useMemo<AppState>(
    () => ({
      ...state,
      setUser,
      setOnline,
      setGemmaReady,
      setGemmaProgress,
      setCurrentScan,
      setRecentScans,
      setCachedPrices,
      setSelectedLanguage,
    }),
    [state, setUser, setOnline, setGemmaReady, setGemmaProgress, setCurrentScan, setRecentScans, setCachedPrices, setSelectedLanguage]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
