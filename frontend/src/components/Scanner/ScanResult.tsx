import { useEffect, useRef } from "react";
import type { GemmaAnalysis, HazardLevel } from "../../types";
import { formatNaira, formatConfidence } from "../../utils/formatters";
import { useTranslation, getLocale } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import type { TtsStatus } from "../../hooks/useAudioTTS";

interface Props {
  result: GemmaAnalysis;
  estimated_value: number;
  hazard_level?: HazardLevel;
  onReadAloud?: () => void;
  onScanAgain?: () => void;
  ttsStatus?: TtsStatus;
  onPause?: () => void;
  onResume?: () => void;
}

const HAZARD_LEVEL_STYLE: Record<HazardLevel, { badge: string; accent: string; label: string }> = {
  low: { badge: "bg-green-100 text-green-800", accent: "border-l-green-400", label: "hazard_safe" },
  medium: { badge: "bg-yellow-100 text-yellow-800", accent: "border-l-yellow-400", label: "hazard_caution" },
  high: { badge: "bg-orange-100 text-orange-800", accent: "border-l-orange-400", label: "hazard_caution" },
  critical: { badge: "bg-red-100 text-red-800", accent: "border-l-red-500", label: "hazard_high_risk" },
};

type SafetyKey = keyof typeof import("../../locales/en.json")["safety_instructions"];

const HAZARD_CONFIG = [
  { test: (h: string[]) => h.length === 0, key: "hazard_safe", color: "bg-green-100 text-green-800" },
  { test: (h: string[]) => h.some((x) => x.includes("acid") || x.includes("lead") || x.includes("mercury")), key: "hazard_high_risk", color: "bg-red-100 text-red-800" },
] as const;

function getHazardKey(hazards: string[]): string {
  for (const cfg of HAZARD_CONFIG) {
    if (cfg.test(hazards)) return cfg.key;
  }
  return "hazard_caution";
}

function getHazardColor(hazards: string[]): string {
  for (const cfg of HAZARD_CONFIG) {
    if (cfg.test(hazards)) return cfg.color;
  }
  return "bg-yellow-100 text-yellow-800";
}

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

export default function ScanResult({ result, estimated_value, hazard_level, onReadAloud, onScanAgain, ttsStatus = "idle", onPause, onResume }: Props) {
  const { t } = useTranslation();
  const { selected_language } = useApp();
  const levelStyle = hazard_level ? HAZARD_LEVEL_STYLE[hazard_level] : null;
  const hazardKey = levelStyle ? levelStyle.label : getHazardKey(result.toxicity_hazards ?? []);
  const hazardColor = levelStyle ? levelStyle.badge : getHazardColor(result.toxicity_hazards ?? []);
  const safetyKey = determineSafetyKey(result.toxicity_hazards ?? []);
  const localeData = getLocale(selected_language);
  const translatedSafety = (localeData.safety_instructions as Record<string, string>)?.[safetyKey] ?? result.safety_instructions;
  const autoReadRef = useRef(false);

  useEffect(() => {
    if (!autoReadRef.current && onReadAloud) {
      autoReadRef.current = true;
      onReadAloud();
    }
  }, [onReadAloud]);

  function renderTtsButton() {
    if (!onReadAloud) return null;

    if (ttsStatus === "playing") {
      return (
        <button onClick={onPause} className="btn-secondary flex-1 gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
          </svg>
          {t("pause")}
        </button>
      );
    }

    if (ttsStatus === "paused") {
      return (
        <button onClick={onResume} className="btn-secondary flex-1 gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          {t("continue")}
        </button>
      );
    }

    return (
      <button onClick={onReadAloud} className="btn-secondary flex-1 gap-2">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
        {t("read_aloud")}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`card space-y-3 ${levelStyle ? `border-l-4 ${levelStyle.accent}` : ""}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">{t("material")}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${hazardColor}`}>
            {t(hazardKey)}
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{result.material_class}</p>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
          <div>
            <span className="text-xs text-gray-500">{t("estimated_value")}</span>
            <p className="text-xl font-bold text-brand-600">{formatNaira(estimated_value)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">{t("confidence")}</span>
            <p className="text-xl font-semibold text-gray-900">{formatConfidence(result.confidence)}</p>
          </div>
        </div>
      </div>

      {result.toxicity_hazards && result.toxicity_hazards.length > 0 && (
        <div className="card space-y-2 border-l-4 border-red-400">
          <h4 className="text-sm font-semibold text-red-700">{t("hazards_detected")}</h4>
          <ul className="space-y-1">
            {result.toxicity_hazards.map((h, i) => {
              const hazardKey = `hazards.${h}` as const;
              const translatedHazard = t(hazardKey);
              return (
                <li key={i} className="flex items-start gap-2 text-sm text-red-600">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                  {translatedHazard !== hazardKey ? translatedHazard : h}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {translatedSafety && (
        <div className="card bg-brand-50 ring-brand-200">
          <p className="text-sm text-brand-800">{translatedSafety}</p>
        </div>
      )}

      <div className="flex gap-3">
        {renderTtsButton()}
        {onScanAgain && (
          <button onClick={onScanAgain} className="btn-primary flex-1">
            {t("scan_again")}
          </button>
        )}
      </div>
    </div>
  );
}
