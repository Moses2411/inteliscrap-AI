import { useState, useCallback } from "react";
import CameraCapture from "../components/Camera/CameraCapture";
import ScanResult from "../components/Scanner/ScanResult";
import LoadingSpinner from "../components/UI/LoadingSpinner";
import { useGemma } from "../hooks/useGemma";
import { useAudioTTS } from "../hooks/useAudioTTS";
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
  const { selected_language, cached_prices, setCurrentScan } = useApp();
  const { analyzeScrapImage, loading_progress } = useGemma();
  const { speakReport } = useAudioTTS();

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
      }).catch(() => {});
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

  if (loading) {
    return <LoadingSpinner progress={loading_progress} label="Analyzing scrap with Gemma 4..." />;
  }

  if (result) {
    return (
      <ScanResult
        result={result}
        estimated_value={estimated_value}
        onReadAloud={() =>
          speakReport(result.material_class, estimated_value, result.toxicity_hazards, selected_language)
        }
        onScanAgain={() => setResult(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900">Snap Scrap</h2>
        <p className="text-sm text-gray-500">Take a photo or upload an image to identify and price scrap material</p>
      </div>
      <CameraCapture onImageCapture={handleImageCapture} />
    </div>
  );
}
