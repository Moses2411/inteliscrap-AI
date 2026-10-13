import type { Language } from "../types";
import { humanizeHazard } from "./bentoPricing";

export const SAFETY_LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
  { value: "yo", label: "Yorùbá" },
  { value: "pcm", label: "Pidgin" },
  { value: "ig", label: "Igbo" },
];

export interface SafetyScriptInput {
  materialClass: string;
  hazards: string[];
  safety: string;
  valuePerKg: number;
}

const HAZARD_PREFIX: Record<Language, string> = {
  en: "Hazards",
  ha: "Hatsari",
  pcm: "Danger",
  yo: "Ewu",
  ig: "Ihe egwu",
};

const RATE_LINE: Record<Language, (material: string, value: number) => string> = {
  en: (m, v) => `Detected ${m}. Estimated market rate ${v} Naira per kilogram.`,
  ha: (m, v) => `An gano ${m}. Kimar kasuwa naira ${v} kowace kilo.`,
  pcm: (m, v) => `We detect ${m}. Market price na ${v} Naira per kilo.`,
  yo: (m, v) => `A rí ${m}. Owó ọjà náírà ${v} fún kílò kan.`,
  ig: (m, v) => `Anyị chọtara ${m}. Ọnụ ahịa ${v} Naira kwa kilo.`,
};

/** Builds a localized, spoken safety script for the current scan. */
export function buildSafetyScript(input: SafetyScriptInput, language: Language): string {
  const rate = RATE_LINE[language](input.materialClass, Math.round(input.valuePerKg));
  const hazardText =
    input.hazards.length > 0
      ? `${HAZARD_PREFIX[language]}: ${input.hazards.map(humanizeHazard).join(", ")}. `
      : "";
  return `${rate} ${hazardText}${input.safety}`.trim();
}
