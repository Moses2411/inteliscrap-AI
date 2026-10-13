import type { HazardLevel } from "../types";
import type { Currency, WeightUnit } from "../types/bento";

/** Indicative FX + mass constants used for the client-side calculator. */
export const NGN_PER_USD = 1550;
export const KG_PER_LB = 0.45359237;

/** Offline fallback price guide (NGN / kg) when the price matrix is unreachable. */
export const DEFAULT_PRICE_NGN: Record<string, number> = {
  copper: 9800,
  brass: 5600,
  aluminum: 2200,
  steel: 480,
  glass: 60,
  "pet-plastic": 130,
  "e-waste": 3200,
  "lead-battery": 700,
  other: 300,
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

function seedFrom(text: string): number {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }
  return seed;
}

/** Deterministic, localized 24h scrap-value trend percentage for a material. */
export function trendPercent(slug: string): number {
  const seed = seedFrom(slug);
  return Math.round(((seed % 900) / 100 - 3.4) * 10) / 10;
}

/** Deterministic sparkline (16 points, 0..100) biased toward the trend. */
export function trendSparkline(slug: string, changePct: number): number[] {
  let seed = seedFrom(slug);
  const points: number[] = [];
  let value = 50;
  for (let i = 0; i < 16; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    value += (seed / 0xffffffff - 0.5) * 9;
    value = Math.max(10, Math.min(90, value));
    points.push(value);
  }
  points.push(Math.max(10, Math.min(90, 50 + changePct * 4)));
  return points;
}

export function humanizeHazard(key: string): string {
  return key
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
