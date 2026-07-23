import en from "../locales/en.json";
import ha from "../locales/ha.json";
import pcm from "../locales/pcm.json";
import { useApp } from "../store/appStore";
import type { Language } from "../types";

type Locale = Record<string, unknown>;

const LOCALE_MAP: Record<Language, Locale> = { en, ha, pcm };

function deepGet(obj: Locale, fallback: Locale, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      let fb: unknown = fallback;
      for (const k of keys) {
        if (fb && typeof fb === "object" && k in fb) {
          fb = (fb as Record<string, unknown>)[k];
        } else {
          return path;
        }
      }
      return typeof fb === "string" ? fb : path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function useTranslation() {
  const { selected_language } = useApp();

  function t(key: string): string {
    const locale = LOCALE_MAP[selected_language] ?? LOCALE_MAP.en;
    return deepGet(locale, LOCALE_MAP.en, key);
  }

  return { t, locale: selected_language };
}

export function getLocale(language: Language): Locale {
  return LOCALE_MAP[language] ?? LOCALE_MAP.en;
}
