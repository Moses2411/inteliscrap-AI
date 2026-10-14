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
  en: (m, v) =>
    `Detected ${m}. The estimated market rate is about ${v} Naira per kilogram. This is only an estimate, prices can change.`,
  ha: (m, v) =>
    `An gano ${m}. Kimanin farashin kasuwa ya kai naira ${v} kowace kilo. Kimanin ne kawai, farashi na iya canzawa.`,
  pcm: (m, v) =>
    `We detect ${m}. The market price be like around ${v} Naira per kilo. Na estimate o, price fit change.`,
  yo: (m, v) =>
    `A rí ${m}. Iye owó ọjà tí a fojú dí ni naira ${v} fún kílò kan. Ìdíwọ̀n ni, owó lè yí padà.`,
  ig: (m, v) =>
    `Anyị chọtara ${m}. Atụmatụ ọnụahịa ahịa bụ ihe dị ka naira ${v} kwa kilo. Nke a bụ atụmatụ naanị, ọnụahịa nwere ike ịgbanwe.`,
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
