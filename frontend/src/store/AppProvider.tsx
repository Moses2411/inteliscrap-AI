import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { VisionAnalysis, Language, PriceMatrixEntry, ScrapScan, User, Theme } from "../types";
import { AppContext, type AppState } from "./appStore";

type Action =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_ONLINE"; payload: boolean }
  | { type: "SET_CURRENT_SCAN"; payload: VisionAnalysis | null }
  | { type: "SET_RECENT_SCANS"; payload: ScrapScan[] }
  | { type: "SET_CACHED_PRICES"; payload: PriceMatrixEntry[] }
  | { type: "SET_LANGUAGE"; payload: Language }
  | { type: "SET_THEME"; payload: Theme };

interface State {
  user: User | null;
  is_online: boolean;
  current_scan: VisionAnalysis | null;
  recent_scans: ScrapScan[];
  cached_prices: PriceMatrixEntry[];
  selected_language: Language;
  theme: Theme;
}

function initialTheme(): Theme {
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const initialState: State = {
  user: null,
  is_online: navigator.onLine,
  current_scan: null,
  recent_scans: [],
  cached_prices: [],
  selected_language: (localStorage.getItem("language") as Language) || "ha",
  theme: initialTheme(),
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_ONLINE":
      return { ...state, is_online: action.payload };
    case "SET_CURRENT_SCAN":
      return { ...state, current_scan: action.payload };
    case "SET_RECENT_SCANS":
      return { ...state, recent_scans: action.payload };
    case "SET_CACHED_PRICES":
      return { ...state, cached_prices: action.payload };
    case "SET_LANGUAGE":
      return { ...state, selected_language: action.payload };
    case "SET_THEME":
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    localStorage.setItem("language", state.selected_language);
  }, [state.selected_language]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", state.theme === "dark");
    localStorage.setItem("theme", state.theme);
  }, [state.theme]);

  const setUser = useCallback((user: User | null) => dispatch({ type: "SET_USER", payload: user }), []);
  const setOnline = useCallback((online: boolean) => dispatch({ type: "SET_ONLINE", payload: online }), []);
  const setCurrentScan = useCallback((scan: VisionAnalysis | null) => dispatch({ type: "SET_CURRENT_SCAN", payload: scan }), []);
  const setRecentScans = useCallback((scans: ScrapScan[]) => dispatch({ type: "SET_RECENT_SCANS", payload: scans }), []);
  const setCachedPrices = useCallback((prices: PriceMatrixEntry[]) => dispatch({ type: "SET_CACHED_PRICES", payload: prices }), []);
  const setSelectedLanguage = useCallback((lang: Language) => dispatch({ type: "SET_LANGUAGE", payload: lang }), []);
  const toggleTheme = useCallback(() => {
    dispatch({ type: "SET_THEME", payload: state.theme === "dark" ? "light" : "dark" });
  }, [state.theme]);

  const value = useMemo<AppState>(
    () => ({
      ...state,
      setUser,
      setOnline,
      setCurrentScan,
      setRecentScans,
      setCachedPrices,
      setSelectedLanguage,
      toggleTheme,
    }),
    [
      state,
      setUser,
      setOnline,
      setCurrentScan,
      setRecentScans,
      setCachedPrices,
      setSelectedLanguage,
      toggleTheme,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}