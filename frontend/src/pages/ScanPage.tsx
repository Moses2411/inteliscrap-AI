import { useState, useCallback } from "react";
import { Camera, Recycle, Zap, WifiOff, ShieldCheck, AlertTriangle } from "lucide-react";
import CameraCapture from "../components/Camera/CameraCapture";
import ScanResult from "../components/Scanner/ScanResult";
import ManualMaterialSelect from "../components/Scanner/ManualMaterialSelect";
import PostPickupForm from "../components/Pickup/PostPickupForm";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { useVision } from "../hooks/useVision";
import { useAudioTTS } from "../hooks/useAudioTTS";
import { useTranslation } from "../hooks/useTranslation";
import { useApp } from "../store/appStore";
import { saveScanLocally } from "../services/db";
import { getCategoryBySlug } from "../services/materials";
import { resolveTradeRule } from "../services/language";
import type { VisionAnalysis } from "../types";

export default function ScanPage() {
  const [result, setResult] = useState<VisionAnalysis | null>(null);
  const [estimated_value, setEstimatedValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const { t } = useTranslation();
  const { selected_language, cached_prices, setCurrentScan } = useApp();
  const { analyze, loadingProgress } = useVision();
  const { speakReport, pause, resume, status: ttsStatus } = useAudioTTS();

  const finishWith = useCallback(
    async (analysis: VisionAnalysis) => {
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

  if (loading) {
    return (
      <div
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-20" />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <Recycle className="h-8 w-8 animate-spin text-brand-600" style={{ animationDuration: "2.5s" }} aria-hidden="true" />
          </span>
        </div>
        <LoadingSpinner progress={loadingProgress} label={t("analyzing_with_ai")} />
        <p className="max-w-xs text-sm text-gray-500 dark:text-gray-400">{t("analyzing_desc")}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-300">
        <ScanResult
          result={result}
          hazard_level={result.hazard_level}
          estimated_value={estimated_value}
          onReadAloud={() =>
            speakReport(result.material_class, estimated_value, result.toxicity_hazards, selected_language)
          }
          onScanAgain={() => setResult(null)}
          ttsStatus={ttsStatus}
          onPause={pause}
          onResume={resume}
        />
        <div className="mx-auto max-w-md">
          <PostPickupForm analysis={result} onReset={() => setResult(null)} />
        </div>
      </div>
    );
  }

  if (manualMode) {
    return <ManualMaterialSelect onSelect={handleManualSelect} onRetry={() => setManualMode(false)} />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-8 pt-2">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-950">
          <Camera className="h-7 w-7 text-brand-700 dark:text-brand-300" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t("snap_scrap")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{t("snap_scrap_desc")}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CameraCapture onImageCapture={handleImageCapture} />
      </div>

      <div className="grid grid-cols-3 gap-2" role="list" aria-label={t("how_it_works")}>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center dark:bg-gray-900">
          <Zap className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-300">{t("feature_instant_ai")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center dark:bg-gray-900">
          <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-300">{t("feature_safety_tips")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center dark:bg-gray-900">
          <WifiOff className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-300">{t("feature_works_offline")}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" role="note">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {t("manual_fallback_hint")}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t("scans_save_desc")}</p>
    </div>
  );
}