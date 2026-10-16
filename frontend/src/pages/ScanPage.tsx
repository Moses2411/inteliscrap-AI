import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Download, Recycle, Zap, WifiOff, ShieldCheck, AlertTriangle } from "lucide-react";
import { LiveScanner } from "../components/Scanner/LiveScanner";
import ScanResult from "../components/Scanner/ScanResult";
import ManualMaterialSelect from "../components/Scanner/ManualMaterialSelect";
import PostPickupForm from "../components/Pickup/PostPickupForm";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { PageMotion, pageItem } from "../components/ui/PageMotion";
import { useVision } from "../hooks/useVision";
import { useEdgeModel } from "../hooks/useEdgeModel";
import { useAudioTTS } from "../hooks/useAudioTTS";
import { useTranslation } from "../hooks/useTranslation";
import { useApp } from "../store/appStore";
import { getRole } from "../services/auth";
import { saveScanLocally } from "../services/db";
import { getCategoryBySlug } from "../services/materials";
import { resolveTradeRule } from "../services/language";
import type { VisionAnalysis, VisionCandidate, VisionModelStatus } from "../types";

/**
 * Tells the user whether on-device detection is ready. The model downloads once
 * when there is connectivity and is then cached, so this makes that one-time
 * step explicit instead of leaving an unexplained delay on the first scan.
 */
function ModelReadinessChip({ status }: { status: VisionModelStatus | null }) {
  if (status?.verified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        AI model ready — scans work offline
      </span>
    );
  }
  if (status?.reason === "load_error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
        <Download className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
        Downloading AI model — one time, needs data
      </span>
    );
  }
  if (status?.reason === "model_missing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400/30 bg-slate-500/10 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
        Basic mode — no AI model yet
      </span>
    );
  }
  return null;
}

export default function ScanPage() {
  const role = getRole();
  if (role !== "seller" && role !== "collector") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Restricted</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Scanning and listing functionality is only available for Sellers and Collectors.
          </p>
        </div>
      </div>
    );
  }

  return <ScanWorkspace role={role} />;
}

function ScanWorkspace({ role }: { role: "seller" | "collector" }) {
  const [result, setResult] = useState<VisionAnalysis | null>(null);
  const [estimated_value, setEstimatedValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const { t } = useTranslation();
  const { selected_language, cached_prices, setCurrentScan } = useApp();
  const { analyze, loadingProgress } = useVision();
  const { speakReport, pause, resume, status: ttsStatus } = useAudioTTS();
  const edgeModel = useEdgeModel();

  const finishWith = useCallback(
    async (analysis: VisionAnalysis, options?: { persist?: boolean }) => {
      const persist = options?.persist ?? true;
      setResult(analysis);
      setCurrentScan(analysis);

      const priceEntry = cached_prices.find(
        (p) => p.material_class.toLowerCase() === analysis.material_class.toLowerCase()
      );
      let value = priceEntry ? priceEntry.price_per_kg_naira : 0;
      if (!value && navigator.onLine) {
        try {
          const category = await getCategoryBySlug(analysis.material_slug);
          if (category) value = category.price_per_kg_naira;
        } catch {
          // keep 0; the pickup form resolves the authoritative price server-side
        }
      }
      setEstimatedValue(value);

      if (!persist) return;

      saveScanLocally({
        id: crypto.randomUUID(),
        user_id: "",
        material_class: analysis.material_class,
        estimated_naira_value: value,
        confidence_score: analysis.confidence,
        toxicity_hazards: analysis.toxicity_hazards,
        safety_instructions: analysis.safety_instructions,
        captured_at: new Date().toISOString(),
        is_synced: false,
        is_deleted: false,
      }).catch(() => {});
    },
    [cached_prices, setCurrentScan]
  );

  const handleImageCapture = useCallback(
    async (blob: Blob) => {
      setResult(null);
      setManualMode(false);
      setLoading(true);
      try {
        const analysis = await analyze(blob);
        await finishWith(analysis);
      } catch {
        setManualMode(true);
      } finally {
        setLoading(false);
      }
    },
    [analyze, finishWith]
  );

  const handleManualSelect = useCallback(
    async (slug: string) => {
      const rule = resolveTradeRule(slug);
      await finishWith({
        material_class: rule.material,
        material_slug: rule.slug,
        confidence: 0,
        toxicity_hazards: rule.hazards,
        safety_instructions: rule.safety,
        hazard_level: rule.hazardLevel,
        source: "manual",
      });
      setManualMode(false);
    },
    [finishWith]
  );

  const handleConfirmMaterial = useCallback(
    async (candidate: VisionCandidate) => {
      if (!result) return;
      const rule = resolveTradeRule(candidate.material_slug);
      // The user confirmed one of the AI's own candidates: keep the originating
      // source label but clear the uncertainty. The original scan was already
      // persisted, so do not write a second record.
      await finishWith(
        {
          ...result,
          material_class: candidate.material_class || rule.material,
          material_slug: rule.slug,
          confidence: candidate.confidence,
          toxicity_hazards: rule.hazards,
          safety_instructions: rule.safety,
          hazard_level: rule.hazardLevel,
          uncertain: false,
          candidates: undefined,
        },
        { persist: false }
      );
    },
    [result, finishWith]
  );

  const handleResolveMaterial = useCallback(
    async (slug: string) => {
      if (!result) return;
      const rule = resolveTradeRule(slug);
      // A physical test (magnet/scratch/flex) resolved the material. It is more
      // reliable than pixels, so trust it, but keep the originating source label
      // and never re-persist the scan.
      const known = result.candidates?.find((candidate) => candidate.material_slug === rule.slug);
      await finishWith(
        {
          ...result,
          material_class: rule.material,
          material_slug: rule.slug,
          confidence: known?.confidence ?? 0.9,
          toxicity_hazards: rule.hazards,
          safety_instructions: rule.safety,
          hazard_level: rule.hazardLevel,
          uncertain: false,
          candidates: undefined,
        },
        { persist: false }
      );
    },
    [result, finishWith]
  );

  if (loading) {
    return (
      <div
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-brand-400"
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: [1, 1.9], opacity: [0.35, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut" }}
          />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              className="inline-flex"
              aria-hidden="true"
            >
              <Recycle className="h-8 w-8 text-brand-600" />
            </motion.span>
          </span>
        </div>
        <LoadingSpinner progress={loadingProgress} label={t("analyzing_with_ai")} />
        <p className="max-w-xs text-sm text-slate-600 dark:text-slate-400">{t("analyzing_desc")}</p>
      </div>
    );
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-md space-y-4"
      >
        <h1 className="sr-only">{t("material")}</h1>
        <ScanResult
          result={result}
          hazard_level={result.hazard_level}
          estimated_value={estimated_value}
          onReadAloud={() =>
            speakReport(result.material_class, estimated_value, result.toxicity_hazards, selected_language)
          }
          onScanAgain={() => setResult(null)}
          onConfirmMaterial={handleConfirmMaterial}
          onDisambiguate={handleResolveMaterial}
          onChooseManually={() => {
            setResult(null);
            setManualMode(true);
          }}
          ttsStatus={ttsStatus}
          onPause={pause}
          onResume={resume}
        />
        <PostPickupForm analysis={result} onReset={() => setResult(null)} />
      </motion.div>
    );
  }

  if (manualMode) {
    return <ManualMaterialSelect onSelect={handleManualSelect} onRetry={() => setManualMode(false)} />;
  }

  return (
    <PageMotion className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-8 pt-2">
      <motion.div variants={pageItem} className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950">
          <Camera className="h-7 w-7 text-brand-700 dark:text-brand-300" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("snap_scrap")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t("snap_scrap_desc")}</p>
        </div>
        <ModelReadinessChip status={edgeModel} />
      </motion.div>

      <motion.div variants={pageItem}>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-obsidian-950 p-3 shadow-bento">
          <div className="h-[24rem] sm:h-[26rem]">
            <LiveScanner
              active={cameraActive}
              onActiveChange={setCameraActive}
              onCapture={(blob) => void handleImageCapture(blob)}
              busy={loading}
              allowUpload={role === "collector"}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={pageItem}
        className="grid grid-cols-3 gap-2"
        role="list"
        aria-label={t("how_it_works")}
      >
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-3 text-center dark:bg-slate-900">
          <Zap className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">{t("feature_instant_ai")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-3 text-center dark:bg-slate-900">
          <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">{t("feature_safety_tips")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-3 text-center dark:bg-slate-900">
          <WifiOff className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-slate-700 dark:text-slate-300">{t("feature_works_offline")}</span>
        </div>
      </motion.div>

      <motion.div
        variants={pageItem}
        className="flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
        role="note"
      >
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t("manual_fallback_hint")}
      </motion.div>

      <motion.p variants={pageItem} className="text-center text-xs text-slate-500 dark:text-slate-400">
        {t("scans_save_desc")}
      </motion.p>
    </PageMotion>
  );
}