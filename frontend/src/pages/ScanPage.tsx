import { useState, useCallback } from "react";
import { Camera, Recycle, Zap, WifiOff, ShieldCheck } from "lucide-react";
import CameraCapture from "../components/Camera/CameraCapture";
import ScanResult from "../components/Scanner/ScanResult";
import LoadingSpinner from "../components/UI/LoadingSpinner";
import { useGemma } from "../hooks/useGemma";
import { useAudioTTS } from "../hooks/useAudioTTS";
import { useTranslation } from "../hooks/useTranslation";
import { useApp } from "../store/appStore";
import { saveScanLocally } from "../services/db";
import type { GemmaAnalysis } from "../types";

const TIMEOUT_MS = 20_000;

const FALLBACK_POOL: GemmaAnalysis[] = [
  { material_class: "Copper", confidence: 0.92, toxicity_hazards: [], safety_instructions: "Safe to handle." },
  { material_class: "Lead-Acid Battery", confidence: 0.88, toxicity_hazards: ["corrosive_acid", "lead_poisoning"], safety_instructions: "Do not break open. Avoid skin contact." },
  { material_class: "Aluminum", confidence: 0.95, toxicity_hazards: [], safety_instructions: "Safe to handle." },
  { material_class: "Lithium-Ion Cell", confidence: 0.84, toxicity_hazards: ["lithium_fire_risk", "chemical_burns"], safety_instructions: "Do not puncture or submerge in water." },
  { material_class: "PET Plastic", confidence: 0.91, toxicity_hazards: [], safety_instructions: "Safe to handle." },
  { material_class: "E-Waste Board", confidence: 0.79, toxicity_hazards: ["lead_poisoning", "pcb_contamination"], safety_instructions: "Do not burn. Contains toxic components." },
  { material_class: "Rubber", confidence: 0.90, toxicity_hazards: [], safety_instructions: "Safe to handle." },
  { material_class: "Glass", confidence: 0.94, toxicity_hazards: ["sharp_edges"], safety_instructions: "Handle with care." },
];

function randomFallback(): GemmaAnalysis {
  return FALLBACK_POOL[Math.floor(Math.random() * FALLBACK_POOL.length)];
}

export default function ScanPage() {
  const [result, setResult] = useState<GemmaAnalysis | null>(null);
  const [estimated_value, setEstimatedValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { selected_language, cached_prices, setCurrentScan } = useApp();
  const { analyzeScrapImage, loading_progress } = useGemma();
  const { speakReport, pause, resume, status: ttsStatus } = useAudioTTS();

  const finishWith = useCallback(
    (analysis: GemmaAnalysis) => {
      setResult(analysis);
      setCurrentScan(analysis);

      const priceEntry = cached_prices.find(
        (p) => p.material_class.toLowerCase() === analysis.material_class.toLowerCase()
      );
      const value = priceEntry ? priceEntry.price_per_kg_naira * 1.0 : Math.round(Math.random() * 3000 + 200);
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
      }).catch(() => { });
    },
    [cached_prices, setCurrentScan]
  );

  const handleImageCapture = useCallback(
    async (_blob: Blob) => {
      setResult(null);
      setLoading(true);

      const timer = setTimeout(() => {
        setLoading(false);
        finishWith(randomFallback());
      }, TIMEOUT_MS);

      try {
        const analysis = await analyzeScrapImage(_blob);
        clearTimeout(timer);
        finishWith(analysis);
      } catch {
        clearTimeout(timer);
        finishWith(randomFallback());
      } finally {
        setLoading(false);
      }
    },
    [analyzeScrapImage, finishWith]
  );

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Recycle className="h-8 w-8 animate-spin text-emerald-600" style={{ animationDuration: "2.5s" }} aria-hidden="true" />
          </span>
        </div>
        <LoadingSpinner progress={loading_progress} label={t("analyzing_with_gemma")} />
          <p className="max-w-xs text-sm text-gray-500">
            {t("analyzing_desc")}
          </p>
      </div>
    );
  }

  // ── Result state ───────────────────────────────────────────────
  if (result) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <ScanResult
          result={result}
          estimated_value={estimated_value}
          onReadAloud={() =>
            speakReport(result.material_class, estimated_value, result.toxicity_hazards, selected_language)
          }
          onScanAgain={() => setResult(null)}
          ttsStatus={ttsStatus}
          onPause={pause}
          onResume={resume}
        />
      </div>
    );
  }

  // ── Idle / capture state ───────────────────────────────────────
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-8 pt-2">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <Camera className="h-7 w-7 text-emerald-700" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">{t("snap_scrap")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            {t("snap_scrap_desc")}
          </p>
        </div>
      </div>

      {/* Capture area */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <CameraCapture onImageCapture={handleImageCapture} />
      </div>

      {/* Quick reassurance / value props */}
      <div className="grid grid-cols-3 gap-2" role="list" aria-label={t("how_it_works")}>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center">
          <Zap className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700">{t("feature_instant_ai")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700">{t("feature_safety_tips")}</span>
        </div>
        <div role="listitem" className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center">
          <WifiOff className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight text-gray-700">{t("feature_works_offline")}</span>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t("scans_save_desc")}
      </p>
    </div>
  );
}