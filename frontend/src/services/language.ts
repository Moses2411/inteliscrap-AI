import type { HazardLevel } from "../types";

export interface TradeRule {
  material: string;
  slug: string;
  hazards: string[];
  hazardLevel: HazardLevel;
  safety: string;
}

const TRADE_RULES: Record<string, TradeRule> = {
  copper: { material: "Copper", slug: "copper", hazards: [], hazardLevel: "low", safety: "Safe to handle." },
  aluminum: { material: "Aluminum", slug: "aluminum", hazards: [], hazardLevel: "low", safety: "Safe to handle." },
  "pet-plastic": { material: "PET Plastic", slug: "pet-plastic", hazards: [], hazardLevel: "low", safety: "Safe to handle." },
  "lead-battery": {
    material: "Lead-Acid Battery",
    slug: "lead-battery",
    hazards: ["corrosive_acid", "lead_poisoning"],
    hazardLevel: "critical",
    safety: "Do not break open. Avoid skin contact.",
  },
  brass: { material: "Brass", slug: "brass", hazards: [], hazardLevel: "low", safety: "Safe to handle." },
  steel: { material: "Steel", slug: "steel", hazards: [], hazardLevel: "low", safety: "Safe to handle." },
  "e-waste": {
    material: "E-Waste Board",
    slug: "e-waste",
    hazards: ["lead_poisoning", "pcb_contamination"],
    hazardLevel: "high",
    safety: "Do not burn. Contains toxic components.",
  },
  glass: { material: "Glass", slug: "glass", hazards: ["sharp_edges"], hazardLevel: "medium", safety: "Handle with care." },
};

export function resolveTradeRule(slug: string): TradeRule {
  return (
    TRADE_RULES[slug] ?? {
      material: "Unknown",
      slug: "other",
      hazards: [],
      hazardLevel: "low",
      safety: "Handle with care.",
    }
  );
}

export function computeFairValue(weightKg: number, pricePerKgNaira: number): number {
  return weightKg * pricePerKgNaira;
}
