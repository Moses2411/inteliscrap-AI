import { useCallback, useRef, useState } from "react";
import en from "../locales/en.json";
import ha from "../locales/ha.json";
import pcm from "../locales/pcm.json";
import yo from "../locales/yo.json";
import ig from "../locales/ig.json";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

type HazardKey = keyof typeof ha.hazards;
type SafetyKey = keyof typeof ha.safety_instructions;

type Language = "en" | "ha" | "pcm" | "yo" | "ig";

const LOCALE_MAP = { en, ha, pcm, yo, ig } as const;

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

/**
 * Nigerian-pidgin spelling is phonetic shorthand, and Google TTS reads the
 * particle "na" as a clipped grunt. Pidgin speakers say it "Nah", so spell it
 * that way for the speech engine only — on-screen text keeps the real spelling.
 */
function normalizeForSpeech(text: string, language: Language): string {
  if (language !== "pcm") return text;
  return text.replace(/\bna\b/gi, "Nah");
}

async function playAudio(
  src: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  cancelledRef: React.MutableRefObject<boolean>,
  pausedRef: React.MutableRefObject<boolean>,
  onTime: (fraction: number) => void,
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

      let interval: ReturnType<typeof setInterval> | undefined;

      const cleanup = () => {
        if (interval) clearInterval(interval);
        URL.revokeObjectURL(blobUrl);
        audio.remove();
        if (audioRef.current === audio) audioRef.current = null;
      };

      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = (e) => { console.warn("TTS playback error", e); cleanup(); resolve(false); };
      audio.ontimeupdate = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          onTime(Math.min(1, audio.currentTime / audio.duration));
        }
      };

      document.body.appendChild(audio);
      audioRef.current = audio;

      // If pause was pressed while this sentence was still loading, stay paused;
      // resume() will call play() on this same element.
      if (pausedRef.current) {
        // leave paused; resume() starts it
      } else {
        audio.play().catch((err) => {
          console.warn("TTS play() failed", err);
          cleanup();
          resolve(false);
        });
      }

      interval = setInterval(() => {
        if (cancelledRef.current) {
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
export interface TtsProgress {
  /** 1-based index of the sentence currently playing. */
  current: number;
  total: number;
  /** Smooth 0..1 across the whole report; null when unknown (browser TTS fallback). */
  fraction: number | null;
}

export function useAudioTTS() {
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [progress, setProgress] = useState<TtsProgress | null>(null);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const usingFallbackRef = useRef(false);
  const fallbackUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakReport = useCallback(
    async (materialClass: string, nairaValue: number, hazards: string[] = [], language: Language = "en") => {
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
        speechString = `An gano ${materialClass}. Kimanin farashi ya kai naira ${nairaValue} kowace kilo. Wannan kimanin ne kawai, farashi na iya canzawa.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else if (language === "pcm") {
        const hazardText = hazards.length > 0
          ? " Danger: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `We find ${materialClass}. The price be like around ${nairaValue} Naira per kg. Na estimate o, price fit change.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else if (language === "yo") {
        const hazardText = hazards.length > 0
          ? " Ẹ̀rọ: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `A rí ${materialClass}. Iye owó tí a fojú dí ni naira ${nairaValue} fún kilo kan. Ìdíwọ̀n ni, owó lè yí padà.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else if (language === "ig") {
        const hazardText = hazards.length > 0
          ? " Njọ: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `A chọpụtara ${materialClass}. Atụmatụ ọnụahịa bụ ihe dị ka naira ${nairaValue} kwa kilo. Nke a bụ atụmatụ naanị, ọnụahịa nwere ike ịgbanwe.${hazardText}${locale.safety_instructions[safetyKey]}`;
      } else {
        const hazardText = hazards.length > 0
          ? " Hazards: " + hazards.map((h) => locale.hazards[h as HazardKey] || h).join(". ") + ". "
          : "";
        speechString = `Detected ${materialClass}. The estimated price is about ${nairaValue} Naira per kg. This is only an estimate, prices can change.${hazardText}${locale.safety_instructions[safetyKey]}`;
      }

      const ttsLang = language === "ha" ? "ha" : language === "pcm" ? "en-NG" : language === "yo" ? "yo" : language === "ig" ? "ig" : "en";

      // Spell pidgin "na" as "Nah" for the speech engine (display text unchanged).
      const spokenText = normalizeForSpeech(speechString, language);

      // Split into sentences so each chunk stays under Google TTS length limit
      const sentences = spokenText.match(/[^.!?]+[.!?]+/g) || [spokenText];

      // Try server TTS
      usingFallbackRef.current = false;
      let allOk = true;
      const total = sentences.length;
      for (let i = 0; i < total; i++) {
        const sentence = sentences[i];
        if (cancelledRef.current) { allOk = false; break; }

        while (pausedRef.current && !cancelledRef.current) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (cancelledRef.current) { allOk = false; break; }

        setProgress({ current: i + 1, total, fraction: i / total });

        const ok = await playAudio(
          `${API_BASE}/api/v1/tts?text=${encodeURIComponent(sentence.trim())}&lang=${ttsLang}`,
          currentAudioRef,
          cancelledRef,
          pausedRef,
          (within) => setProgress({ current: i + 1, total, fraction: (i + within) / total }),
        );
        if (!ok) { allOk = false; break; }
      }

      if (!allOk && !cancelledRef.current) {
        // Fallback: use browser speech synthesis for the full text at once
        if ("speechSynthesis" in window) {
          usingFallbackRef.current = true;
          setProgress({ current: 1, total: 1, fraction: null });
          const u = new SpeechSynthesisUtterance(speechString);
          u.lang = ttsLang === "ha" ? "ha-NG" : ttsLang === "yo" ? "yo-NG" : ttsLang === "ig" ? "ig-NG" : "en-NG";
          u.rate = 0.85;
          u.onend = () => {
            playingRef.current = false;
            setStatus("idle");
            setProgress(null);
          };
          u.onpause = () => setStatus("paused");
          u.onresume = () => setStatus("playing");
          fallbackUtteranceRef.current = u;
          window.speechSynthesis.speak(u);
          return;
        }
      }

      playingRef.current = false;
      setStatus("idle");
      setProgress(null);
    },
    []
  );

  const pause = useCallback(() => {
    // Always pause the live audio element if one exists (covers the fetch-window
    // race where the element was created but not yet in `usingFallback` mode).
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
    pausedRef.current = true;
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.play().catch(() => {});
    }
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (usingFallbackRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      fallbackUtteranceRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.remove();
      currentAudioRef.current = null;
    }
    playingRef.current = false;
    pausedRef.current = false;
    setStatus("idle");
    setProgress(null);
  }, []);

  return { speakReport, pause, resume, stop, status, progress };
}
