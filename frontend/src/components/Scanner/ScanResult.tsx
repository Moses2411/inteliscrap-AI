import { useEffect, useId, useRef, useState } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Pause,
  Play,
  ScanLine,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import type { VisionAnalysis, VisionCandidate, HazardLevel } from "../../types";
import { formatNairaEstimate, formatConfidence } from "../../utils/formatters";
import { useTranslation, getLocale } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import type { TtsStatus } from "../../hooks/useAudioTTS";
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
  onPause?: () => void;
  onResume?: () => void;
}

type SafetyKey = keyof typeof import("../../locales/en.json")["safety_instructions"];

/** Severity presentation for the verdict hero. Theme-independent (dark surface). */
const LEVEL_META: Record<HazardLevel, { labelKey: string; dot: string; chip: string; pulse: boolean }> = {
  low: { labelKey: "hazard_safe", dot: "bg-emerald-400", chip: "text-emerald-100 ring-emerald-400/25", pulse: false },
  medium: { labelKey: "hazard_caution", dot: "bg-amber-400", chip: "text-amber-100 ring-amber-400/25", pulse: false },
  high: { labelKey: "hazard_caution", dot: "bg-orange-400", chip: "text-orange-100 ring-orange-400/25", pulse: false },
  critical: { labelKey: "hazard_high_risk", dot: "bg-red-400", chip: "text-red-100 ring-red-400/30", pulse: true },
};

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

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Animated circular gauge that turns the model's confidence into a single,
 * glanceable figure. Sits on the dark verdict surface so it reads as an
 * instrument panel rather than another text row.
 */
function ConfidenceRing({ value, label }: { value: number; label: string }) {
  const gradId = useId();
  const size = 78;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`${label} ${formatConfidence(pct)}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a3e635" />
            <stop offset="45%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base font-bold leading-none tabular-nums text-white">
          {formatConfidence(pct)}
        </span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/50">
          {label}
        </span>
      </div>
    </div>
  );
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
  onPause,
  onResume,
}: Props) {
  const { t } = useTranslation();
  const { selected_language } = useApp();
  const sourceTag = result.source ? `source_${result.source}` : null;
  const hazardKey = hazard_level
    ? LEVEL_META[hazard_level].labelKey
    : getHazardKey(result.toxicity_hazards ?? []);
  const badgeLevel: HazardLevel =
    hazard_level ??
    (hazardKey === "hazard_high_risk" ? "critical" : hazardKey === "hazard_caution" ? "medium" : "low");
  const levelMeta = LEVEL_META[badgeLevel];
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
  const translatedSafety =
    (localeData.safety_instructions as Record<string, string>)?.[safetyKey] ?? result.safety_instructions;
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

  function renderTtsButton() {
    if (!onReadAloud) return null;

    if (ttsStatus === "playing") {
      return (
        <Button variant="secondary" className="flex-1" onClick={onPause}>
          <Pause className="h-4 w-4" aria-hidden="true" />
          {t("pause")}
        </Button>
      );
    }

    if (ttsStatus === "paused") {
      return (
        <Button variant="secondary" className="flex-1" onClick={onResume}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {t("continue")}
        </Button>
      );
    }

    return (
      <Button variant="secondary" className="flex-1" onClick={onReadAloud}>
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        {t("read_aloud")}
      </Button>
    );
  }

  const microLabel = "text-[10px] font-semibold uppercase tracking-[0.16em]";

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-4">
        {/* ── Verdict hero ─────────────────────────────────────────── */}
        <motion.section
          variants={itemVariants}
          aria-labelledby="scan-material-heading"
          className="relative overflow-hidden rounded-3xl bg-obsidian-950 p-5 text-white shadow-bento ring-1 ring-white/10"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-mesh" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" aria-hidden="true" />

          <div className="relative space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <ScanLine className="h-4 w-4 text-brand-300" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className={cn(microLabel, "text-white/45")}>{t("result")}</p>
                  {sourceTag && (
                    <p className="truncate text-[11px] font-medium text-white/70">{t(sourceTag)}</p>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold ring-1",
                  levelMeta.chip,
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", levelMeta.dot, levelMeta.pulse && "animate-pulse-soft")}
                  aria-hidden="true"
                />
                {t(levelMeta.labelKey)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className={cn(microLabel, "text-white/45")}>{t("material")}</p>
                <h2
                  id="scan-material-heading"
                  className="mt-1 text-[28px] font-bold leading-[1.08] tracking-tight text-white"
                >
                  {result.material_class}
                </h2>
              </div>
              <ConfidenceRing value={result.confidence} label={t("confidence")} />
            </div>

            <div className="h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent" aria-hidden="true" />

            <div>
              <p className={cn(microLabel, "text-white/45")}>{t("estimated_value")}</p>
              {estimated_value > 0 ? (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-[26px] font-bold leading-none tracking-tight text-brand-300">
                    {formatNairaEstimate(estimated_value)}
                  </span>
                  <span className="text-xs font-medium text-white/50">{t("per_kg")}</span>
                </div>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-white/60">{t("price_pending")}</p>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-white/45">{t("price_estimate_note")}</p>
          </div>
        </motion.section>

        {/* ── Uncertainty / confirmation ────────────────────────────── */}
        {showConfirm && (
          <motion.section
            variants={itemVariants}
            className="space-y-3 rounded-3xl border border-amber-200/70 bg-amber-50/60 p-4 shadow-card ring-1 ring-amber-200/50 dark:border-amber-900/50 dark:bg-amber-950/20 dark:ring-amber-900/40"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900/50">
                <HelpCircle className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("uncertain_title")}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("uncertain_hint")}
                </p>
              </div>
            </div>

            {family && onDisambiguate && question && (
              <div className="rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-amber-200/60 dark:bg-slate-900/60 dark:ring-amber-900/40">
                <p className={cn(microLabel, "text-slate-500 dark:text-slate-400")}>{t("disambiguate_title")}</p>
                <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">{t(question.titleKey)}</p>
                {question.hintKey && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {t(question.hintKey)}
                  </p>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-2" role="group" aria-label={t(question.titleKey)}>
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleAnswer(question.id, option.id)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-brand-400 hover:bg-brand-50/40 hover:shadow-md active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-600"
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2" role="group" aria-label={t("uncertain_title")}>
              {confirmCandidates.map((candidate) => (
                <button
                  key={candidate.material_slug}
                  type="button"
                  onClick={() => onConfirmMaterial?.(candidate)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition-all hover:border-brand-400 hover:shadow-md active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {candidate.material_class}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {formatConfidence(candidate.confidence)}
                  </span>
                </button>
              ))}
            </div>

            {onChooseManually && (
              <Button variant="secondary" fullWidth onClick={onChooseManually}>
                {t("choose_manually")}
              </Button>
            )}
          </motion.section>
        )}

        {/* ── Coarse-estimate disclaimer ───────────────────────────── */}
        {(result.source === "heuristic" || result.source === "manual") && (
          <motion.div
            variants={itemVariants}
            role="note"
            className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t("estimate_disclaimer")}</span>
          </motion.div>
        )}

        {/* ── Toxicity hazards ─────────────────────────────────────── */}
        {result.toxicity_hazards && result.toxicity_hazards.length > 0 && (
          <motion.section
            variants={itemVariants}
            className="overflow-hidden rounded-3xl border border-red-200/70 bg-white shadow-card dark:border-red-900/40 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2.5 border-b border-red-100 bg-red-50/70 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/25">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900/50">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">{t("hazards_detected")}</h3>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.toxicity_hazards.map((h, i) => {
                const hazardKey = `hazards.${h}`;
                const translatedHazard = t(hazardKey);
                return (
                  <li key={i} className="flex items-start gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                    <span>{translatedHazard !== hazardKey ? translatedHazard : h}</span>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}

        {/* ── Safety guidance ──────────────────────────────────────── */}
        {translatedSafety && (
          <motion.section
            variants={itemVariants}
            className="flex items-start gap-3 rounded-3xl border border-brand-200/70 bg-brand-50/70 p-4 shadow-card dark:border-brand-900/50 dark:bg-brand-950/25"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-900/50">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-brand-800 dark:text-brand-200">{t("safety_title")}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-brand-800/90 dark:text-brand-300">
                {translatedSafety}
              </p>
            </div>
          </motion.section>
        )}

        {/* ── Actions ──────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-2 shadow-card backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
        >
          {renderTtsButton()}
          {onScanAgain && (
            <Button className="flex-1" onClick={onScanAgain}>
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              {t("scan_again")}
            </Button>
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>
  );
}
