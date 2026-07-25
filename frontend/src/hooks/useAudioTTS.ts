import { useCallback, useRef, useState } from "react";
import en from "../locales/en.json";
import ha from "../locales/ha.json";
import pcm from "../locales/pcm.json";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

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

async function playAudio(
  src: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  cancelledRef: React.MutableRefObject<boolean>
): Promise<boolean> {
  try {
    const resp = await fetch(src);
    if (!resp.ok) {
      console.warn("TTS fetch returned", resp.status, resp.statusText);
      return false;
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);

    return await new Promise<boolean>((resolve) => {
      const audio = document.createElement("audio");
      audio.src = blobUrl;
      audio.style.display = "none";

      const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
        audio.remove();
        if (audioRef.current === audio) audioRef.current = null;
      };

      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = (e) => { console.warn("TTS playback error", e); cleanup(); resolve(false); };

      document.body.appendChild(audio);
      audioRef.current = audio;

      audio.play().catch((err) => {
        console.warn("TTS play() failed", err);
        cleanup();
        resolve(false);
      });

      const interval = setInterval(() => {
        if (cancelledRef.current) {
          clearInterval(interval);
          audio.pause();
          cleanup();
          resolve(false);
        }
      }, 200);
    });
  } catch (err) {
    console.warn("TTS fetch error", err);
    return false;
  }
}

export type TtsStatus = "idle" | "playing" | "paused";

export function useAudioTTS() {
  const [status, setStatus] = useState<TtsStatus>("idle");
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const usingFallbackRef = useRef(false);
  const fallbackUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakReport = useCallback(
    async (materialClass: string, nairaValue: number, hazards: string[] = [], language: "en" | "ha" | "pcm" = "en") => {
      if (playingRef.current) return;
      playingRef.current = true;
      cancelledRef.current = false;
      pausedRef.current = false;
      setStatus("playing");

      const locale = LOCALE_MAP[language];
      const safetyKey = determineSafetyKey(hazards);

      let speechString = "";
      if (language === "ha") {
        const hazardText = hazards.length > 0
          ? " Hatsari: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `An gano ${materialClass}. Kilo daya ya kai naira ${nairaValue}.${hazardText}${locale.safety_instructions[safetyKey]}`;
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

      const ttsLang = language === "ha" ? "ha" : language === "pcm" ? "en-NG" : "en";

      // Split into sentences so each chunk stays under Google TTS length limit
      const sentences = speechString.match(/[^.!?]+[.!?]+/g) || [speechString];

      // Try server TTS
      usingFallbackRef.current = false;
      let allOk = true;
      for (const sentence of sentences) {
        if (cancelledRef.current) { allOk = false; break; }

        while (pausedRef.current && !cancelledRef.current) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelledRef.current) { allOk = false; break; }

        const ok = await playAudio(
          `${API_BASE}/api/v1/tts?text=${encodeURIComponent(sentence.trim())}&lang=${ttsLang}`,
          currentAudioRef,
          cancelledRef
        );
        if (!ok) { allOk = false; break; }
      }

      if (!allOk && !cancelledRef.current) {
        // Fallback: use browser speech synthesis for the full text at once
        if ("speechSynthesis" in window) {
          usingFallbackRef.current = true;
          const u = new SpeechSynthesisUtterance(speechString);
          u.lang = ttsLang === "ha" ? "ha-NG" : "en-NG";
          u.rate = 0.85;
          u.onend = () => {
            playingRef.current = false;
            setStatus("idle");
          };
          u.onpause = () => setStatus("paused");
          u.onresume = () => setStatus("playing");
          fallbackUtteranceRef.current = u;
          window.speechSynthesis.speak(u);
          return;
        }
      }

      if (!cancelledRef.current) {
        playingRef.current = false;
        setStatus("idle");
      } else {
        playingRef.current = false;
        setStatus("idle");
      }
    },
    []
  );

  const pause = useCallback(() => {
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    } else if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    pausedRef.current = true;
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    } else if (currentAudioRef.current) {
      currentAudioRef.current.play().catch(() => {});
    }
    pausedRef.current = false;
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      fallbackUtteranceRef.current = null;
    } else if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.remove();
      currentAudioRef.current = null;
    }
    playingRef.current = false;
    pausedRef.current = false;
    setStatus("idle");
  }, []);

  return { speakReport, pause, resume, stop, status };
}
