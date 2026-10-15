import { useEffect, useRef, useState } from "react";
import { HelpCircle, ShieldCheck } from "lucide-react";
import type { VisionAnalysis, VisionCandidate, HazardLevel } from "../../types";
import { formatNairaEstimate, formatConfidence } from "../../utils/formatters";
import { useTranslation, getLocale } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import HazardBadge from "../ui/HazardBadge";
import { AudioReportPlayer } from "./AudioReportPlayer";
import type { TtsStatus, TtsProgress } from "../../hooks/useAudioTTS";
import {
  detectFamily,
  resolveDisambiguation,
  type DisambiguationAnswers,
} from "../../vision/disambiguation";

interface Props {
  result: VisionAnalysis;
  estimated_value: number;
  hazard_level?: HazardLevel;
  onReadAloud?: () => void;
  onScanAgain?: () => void;
  onConfirmMaterial?: (candidate: VisionCandidate) => void;
  onDisambiguate?: (slug: string) => void;
  onChooseManually?: () => void;
  ttsStatus?: TtsStatus;
  ttsProgress?: TtsProgress | null;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

const HAZARD_LEVEL_STYLE: Record<HazardLevel, { accent: string; label: string }> = {
  low: { accent: "border-l-green-400", label: "hazard_safe" },
  medium: { accent: "border-l-yellow-400", label: "hazard_caution" },
  high: { accent: "border-l-orange-400", label: "hazard_caution" },
  critical: { accent: "border-l-red-500", label: "hazard_high_risk" },
};

type SafetyKey = keyof typeof import("../../locales/en.json")["safety_instructions"];

const HAZARD_CONFIG = [
  { test: (h: string[]) => h.length === 0, key: "hazard_safe" },
  { test: (h: string[]) => h.some((x) => x.includes("acid") || x.includes("lead") || x.includes("mercury")), key: "hazard_high_risk" },
] as const;

function getHazardKey(hazards: string[]): string {
  for (const cfg of HAZARD_CONFIG) {
    if (cfg.test(hazards)) return cfg.key;
  }
  return "hazard_caution";
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

export default function ScanResult({
  result,
  estimated_value,
  hazard_level,
  onReadAloud,
  onScanAgain,
  onConfirmMaterial,
  onDisambiguate,
  onChooseManually,
  ttsStatus = "idle",
  ttsProgress = null,
  onPause,
  onResume,
  onStop,
}: Props) {
  const { t } = useTranslation();
  const { selected_language } = useApp();
  const levelStyle = hazard_level ? HAZARD_LEVEL_STYLE[hazard_level] : null;
  const sourceTag = result.source ? `source_${result.source}` : null;
  const hazardKey = levelStyle ? levelStyle.label : getHazardKey(result.toxicity_hazards ?? []);
  const badgeLevel: HazardLevel =
    hazard_level ??
    (hazardKey === "hazard_high_risk" ? "critical" : hazardKey === "hazard_caution" ? "medium" : "low");
  const safetyKey = determineSafetyKey(result.toxicity_hazards ?? []);
  const confirmCandidates = result.uncertain ? result.candidates ?? [] : [];
  const showConfirm =
    result.uncertain &&
    confirmCandidates.length > 0 &&
    Boolean(onConfirmMaterial || onChooseManually);
  const [answers, setAnswers] = useState<DisambiguationAnswers>({});
  const family = showConfirm
    ? detectFamily(confirmCandidates.map((candidate) => candidate.material_slug))
    : null;
  const resolution = family ? resolveDisambiguation(family, answers) : null;
  const question = resolution?.question ?? null;
  const localeData = getLocale(selected_language);
  const translatedSafety = (localeData.safety_instructions as Record<string, string>)?.[safetyKey] ?? result.safety_instructions;
  const autoReadRef = useRef(false);

  useEffect(() => {
    if (!autoReadRef.current && onReadAloud) {
      autoReadRef.current = true;
      onReadAloud();
    }
  }, [onReadAloud]);

  useEffect(() => {
    setAnswers({});
  }, [result]);

  function handleAnswer(questionId: string, optionId: string) {
    if (!family) return;
    const nextAnswers = { ...answers, [questionId]: optionId };
    setAnswers(nextAnswers);
    const next = resolveDisambiguation(family, nextAnswers);
    if (next.resolvedSlug) onDisambiguate?.(next.resolvedSlug);
  }

  return (
    <div className="space-y-4">
      {/* Material result hero */}
      <Card className={`space-y-4 ${levelStyle ? `border-l-4 ${levelStyle.accent}` : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("material")}
            </h2>
            {sourceTag && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {t(sourceTag)}
              </span>
            )}
          </div>
          <HazardBadge level={badgeLevel} />
        </div>

        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {result.material_class}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("estimated_value")}
            </span>
            <p className="mt-0.5 text-2xl font-bold text-brand-600 dark:text-brand-400">
              {formatNairaEstimate(estimated_value)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("confidence")}
            </span>
            <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatConfidence(result.confidence)}
            </p>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {t("price_estimate_note")}
        </p>
      </Card>

      {/* Audio report — its own section so playback is always visible and controllable */}
      {onReadAloud && (
        <AudioReportPlayer
          status={ttsStatus}
          progress={ttsProgress}
          onStart={onReadAloud}
          onPause={onPause ?? (() => {})}
          onResume={onResume ?? (() => {})}
          onStop={onStop ?? (() => {})}
        />
      )}

      {showConfirm && (
        <Card className="space-y-3 border-l-4 border-amber-400 dark:border-amber-600">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("uncertain_title")}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t("uncertain_hint")}</p>
            </div>
          </div>

          {family && onDisambiguate && question && (
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-800">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t("disambiguate_title")}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{t(question.titleKey)}</p>
              {question.hintKey && (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t(question.hintKey)}</p>
              )}
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={t(question.titleKey)}>
                {question.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleAnswer(question.id, option.id)}
                    className="tap-target rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition-all hover:border-brand-400 hover:shadow-sm active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2" role="group" aria-label={t("uncertain_title")}>
            {confirmCandidates.map((candidate) => {
              const pct = Math.round(Math.max(0, Math.min(1, candidate.confidence)) * 100);
              return (
                <button
                  key={candidate.material_slug}
                  type="button"
                  onClick={() => onConfirmMaterial?.(candidate)}
                  className="tap-target w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-all hover:border-brand-400 hover:shadow-sm active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {candidate.material_class}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                      {formatConfidence(candidate.confidence)}
                    </span>
                  </span>
                  <span
                    className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {onChooseManually && (
            <Button variant="secondary" fullWidth onClick={onChooseManually}>
              {t("choose_manually")}
            </Button>
          )}
        </Card>
      )}

      {(result.source === "heuristic" || result.source === "manual") && (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900">
          <HelpCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("estimate_disclaimer")}</span>
        </div>
      )}

      {result.toxicity_hazards && result.toxicity_hazards.length > 0 && (
        <Card className="space-y-2 border-l-4 border-red-400 dark:border-red-600">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{t("hazards_detected")}</h3>
          <ul className="space-y-1.5">
            {result.toxicity_hazards.map((h, i) => {
              const hazardKey = `hazards.${h}` as const;
              const translatedHazard = t(hazardKey);
              return (
                <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" />
                  {translatedHazard !== hazardKey ? translatedHazard : h}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {translatedSafety && (
        <Card className="flex items-start gap-2.5 bg-brand-50 ring-brand-200 dark:bg-brand-950/50 dark:ring-brand-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-brand-800 dark:text-brand-300">{translatedSafety}</p>
        </Card>
      )}

      {onScanAgain && (
        <Button className="w-full" size="lg" onClick={onScanAgain}>
          {t("scan_again")}
        </Button>
      )}
    </div>
  );
}
