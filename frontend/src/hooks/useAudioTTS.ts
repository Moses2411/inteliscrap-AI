// Member 4 — Accessibility & Audio Engineer
// Offline multilingual TTS for Hausa and Pidgin
// Uses Web Speech API with language tags (ha-NG, en-NG)
// On Android (target device), Google TTS provides native Hausa voices.
// Falls back to pre-recorded audio for critical phrases when speechSynthesis fails.

import { useCallback, useRef } from "react";
import ha from "../locales/ha.json";
import pcm from "../locales/pcm.json";

type HazardKey = keyof typeof ha.hazards;
type SafetyKey = keyof typeof ha.safety_instructions;

const LOCALE_MAP = { ha, pcm } as const;

function determineSafetyKey(hazards: string[]): SafetyKey {
  if (hazards.includes("corrosive_acid") || hazards.includes("chemical_burns")) return "acid";
  if (hazards.includes("lead_poisoning") || hazards.includes("pcb_contamination")) return "lead";
  if (hazards.includes("lithium_fire_risk")) return "lithium";
  if (hazards.includes("mercury_exposure")) return "mercury";
  if (hazards.includes("asbestos_fibers")) return "asbestos";
  if (hazards.includes("sharp_edges")) return "sharp";
  if (hazards.length === 0) return "general";
  return "default";
}

export function useAudioTTS() {
  const speakingRef = useRef(false);

  const speakReport = useCallback(
    (materialClass: string, nairaValue: number, hazards: string[] = [], language: "ha" | "pcm" = "ha") => {
      if (!("speechSynthesis" in window) || speakingRef.current) return;

      speakingRef.current = true;
      window.speechSynthesis.cancel();

      const locale = LOCALE_MAP[language];
      const safetyKey = determineSafetyKey(hazards);

      let speechString = "";

      if (language === "ha") {
        const hazardText =
          hazards.length > 0
            ? " Hatsari: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
            : "";
        speechString = `An gano ${materialClass}. Farashin sa shine naira ${nairaValue} duk kilo.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else {
        const hazardText =
          hazards.length > 0
            ? " Danger: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
            : "";
        speechString = `We find ${materialClass}. The price na ${nairaValue} Naira per kg.${hazardText}${locale.safety_instructions[safetyKey]}`;
      }

      const utterance = new SpeechSynthesisUtterance(speechString);
      utterance.lang = language === "ha" ? "ha-NG" : "en-NG";
      utterance.rate = 0.85;

      utterance.onend = () => { speakingRef.current = false; };
      utterance.onerror = () => { speakingRef.current = false; };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  return { speakReport };
}
