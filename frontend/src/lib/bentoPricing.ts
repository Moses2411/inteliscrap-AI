import type { HazardLevel } from "../types";
import type { Currency, WeightUnit } from "../types/bento";

/** Indicative FX + mass constants used for the client-side calculator. */
export const NGN_PER_USD = 1550;
export const KG_PER_LB = 0.45359237;

/**
 * Offline fallback price guide (NGN / kg) when neither the live rate card nor
 * the sync cache is reachable. These mirror the backend seed values in
 * `backend/app/seed.py` so an offline estimate is never wildly wrong. Always
 * prefer the live `/api/v1/materials` values (which carry an update timestamp).
 */
export const DEFAULT_PRICE_NGN: Record<string, number> = {
  copper: 3200,
  brass: 2200,
  aluminum: 700,
  steel: 90,
  glass: 25,
  "pet-plastic": 180,
  "e-waste": 400,
  "lead-battery": 950,
  other: 90,
};

const SLUG_ALIASES: Record<string, string> = {
  copper: "copper",
  aluminium: "aluminum",
  aluminum: "aluminum",
  brass: "brass",
  steel: "steel",
  "stainless steel": "steel",
  glass: "glass",
  "pet plastic": "pet-plastic",
  "pet bottle": "pet-plastic",
  plastic: "pet-plastic",
  hdpe: "pet-plastic",
  ldpe: "pet-plastic",
  "e-waste board": "e-waste",
  "e waste": "e-waste",
  ewaste: "e-waste",
  pcb: "e-waste",
  "circuit board": "e-waste",
  "lead-acid battery": "lead-battery",
  "lead acid battery": "lead-battery",
  battery: "lead-battery",
};

export function slugForMaterial(materialClass: string): string {
  const key = materialClass.trim().toLowerCase();
  if (SLUG_ALIASES[key]) return SLUG_ALIASES[key];
  for (const [alias, slug] of Object.entries(SLUG_ALIASES)) {
    if (key.includes(alias)) return slug;
  }
  return "other";
}

export function hazardLevelFor(slug: string, hazards: string[]): HazardLevel {
  if (slug === "lead-battery") return "critical";
  if (slug === "e-waste") return "high";
  if (slug === "glass" || hazards.includes("sharp_edges")) return "medium";
  return "low";
}

export function defaultPriceFor(slug: string): number {
  return DEFAULT_PRICE_NGN[slug] ?? DEFAULT_PRICE_NGN.other;
}

export function kgToUnit(weightKg: number, unit: WeightUnit): number {
  return unit === "kg" ? weightKg : weightKg / KG_PER_LB;
}

export function unitToKg(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight : weight * KG_PER_LB;
}

export function convertCurrency(naira: number, currency: Currency): number {
  return currency === "NGN" ? naira : naira / NGN_PER_USD;
}

export function money(value: number, currency: Currency): string {
  if (currency === "NGN") return `₦${Math.round(value).toLocaleString("en-NG")}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Convert a NGN/kg price into the selected unit + currency. */
export function unitRate(
  priceNgnPerKg: number,
  unit: WeightUnit,
  currency: Currency,
): number {
  const perUnitNgn = unit === "kg" ? priceNgnPerKg : priceNgnPerKg * KG_PER_LB;
  return convertCurrency(perUnitNgn, currency);
}

export function humanizeHazard(key: string): string {
  return key
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
