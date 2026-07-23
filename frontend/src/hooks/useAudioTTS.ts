import { useCallback, useRef } from "react";
import en from "../locales/en.json";
import ha from "../locales/ha.json";
import pcm from "../locales/pcm.json";

type HazardKey = keyof typeof ha.hazards;
type SafetyKey = keyof typeof ha.safety_instructions;

const LOCALE_MAP = { en, ha, pcm } as const;

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

function playAudio(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.src = src;
    audio.style.display = "none";
    audio.onended = () => { audio.remove(); resolve(true); };
    audio.onerror = () => { audio.remove(); resolve(false); };
    document.body.appendChild(audio);
    audio.play().catch(() => { audio.remove(); resolve(false); });
  });
}

export function useAudioTTS() {
  const playingRef = useRef(false);

  const speakReport = useCallback(
    async (materialClass: string, nairaValue: number, hazards: string[] = [], language: "en" | "ha" | "pcm" = "en") => {
      if (playingRef.current) return;
      playingRef.current = true;

      const locale = LOCALE_MAP[language];
      const safetyKey = determineSafetyKey(hazards);

      let speechString = "";
      if (language === "ha") {
        const hazardText = hazards.length > 0
          ? " Hatsari: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `An gano ${materialClass}. Farashin sa shine naira ${nairaValue} duk kilo.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else if (language === "pcm") {
        const hazardText = hazards.length > 0
          ? " Danger: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `We find ${materialClass}. The price na ${nairaValue} Naira per kg.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else {
        const hazardText = hazards.length > 0
          ? " Hazards: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `Detected ${materialClass}. Estimated value is ${nairaValue} Naira per kg.${hazardText}${locale.safety_instructions[safetyKey]}`;
      }

      const ttsLang = language === "ha" ? "ha" : "en";

      // Split into sentences so each chunk stays under Google TTS length limit
      const sentences = speechString.match(/[^.!?]+[.!?]+/g) || [speechString];

      let allOk = true;
      for (const sentence of sentences) {
        const ok = await playAudio(`/api/v1/tts?text=${encodeURIComponent(sentence.trim())}&lang=${ttsLang}`);
        if (!ok) { allOk = false; break; }
      }

      if (!allOk) {
        // Fallback: use browser speech synthesis for the full text at once
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(speechString);
          u.lang = ttsLang === "ha" ? "ha-NG" : "en-NG";
          u.rate = 0.85;
          u.onend = () => { playingRef.current = false; };
          window.speechSynthesis.speak(u);
          return;
        }
      }

      playingRef.current = false;
    },
    []
  );

  return { speakReport };
}
