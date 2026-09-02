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

const QWEN_MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

type TextGenerator = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ generated_text: string }>>;

let generatorPromise: Promise<TextGenerator> | null = null;

export async function parseTradeText(input: string): Promise<string> {
  if (!generatorPromise) {
    generatorPromise = import("@huggingface/transformers").then(
      (mod) => mod.pipeline("text-generation", QWEN_MODEL, { device: "wasm", dtype: "q4" }),
    ) as unknown as Promise<TextGenerator>;
  }
  try {
    const generator = await generatorPromise;
    const out = await generator(input, { max_new_tokens: 64, temperature: 0.1 });
    return out[0]?.generated_text ?? input;
  } catch {
    return input;
  }
}
