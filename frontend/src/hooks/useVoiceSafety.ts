import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceStatus } from "../types/bento";

const LANG_TAG: Record<string, string> = {
  en: "en-NG",
  ha: "ha-NG",
  pcm: "en-NG",
  yo: "yo-NG",
  ig: "ig-NG",
};

/**
 * Speech-synthesis controller for the localized safety card.
 *
 * Uses the browser's SpeechSynthesis API (with volume control) and degrades
 * gracefully when the platform has no voice engine installed.
 */
export function useVoiceSafety() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [supportedVoices, setSupportedVoices] = useState(false);
  const [voicesProbed, setVoicesProbed] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    const update = () => {
      setSupportedVoices(window.speechSynthesis.getVoices().length > 0);
      setVoicesProbed(true);
    };
    update();
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", update);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, language: string, volume: number): boolean => {
      if (!supported) return false;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = LANG_TAG[language] ?? "en-NG";
      utterance.rate = 0.92;
      utterance.volume = Math.max(0, Math.min(1, volume));
      utterance.onend = () => setStatus("idle");
      utterance.onerror = () => setStatus("idle");
      utteranceRef.current = utterance;
      setStatus("speaking");
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [supported],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setStatus("idle");
  }, [supported]);

  return {
    supported,
    /** True once getVoices() has been probed (voices can load lazily). */
    voicesProbed,
    supportedVoices,
    status,
    speak,
    pause,
    resume,
    stop,
  };
}
