import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, ScanSearch, ShieldCheck, Wallet } from "lucide-react";
import { BentoCard, BentoGrid } from "../components/bento/BentoGrid";
import { NetworkBar } from "../components/bento/NetworkBar";
import { ScannerModule } from "../components/bento/ScannerModule";
import { ValuationCard } from "../components/bento/ValuationCard";
import { VoiceSafetyCard } from "../components/bento/VoiceSafetyCard";
import { ScanHistoryTable } from "../components/bento/ScanHistoryTable";
import { useNetworkStatus, useEngineStatus } from "../hooks/useBentoSystem";
import { useScanHistory } from "../hooks/useScanHistory";
import { useVoiceSafety } from "../hooks/useVoiceSafety";
import { useVision } from "../hooks/useVision";
import { useApp } from "../store/appStore";
import { getCategoryBySlug } from "../services/materials";
import { defaultPriceFor } from "../lib/bentoPricing";
import { SAFETY_LANGUAGES, buildSafetyScript } from "../lib/voiceSafety";
import type { HazardLevel, Language, ScrapScan, VisionAnalysis } from "../types";
import type { BoundingBox, Currency, HistoryFilter, SafetyGuidance, WeightUnit } from "../types/bento";

const BAR_COUNT = 24;
const DEFAULT_WEIGHT_KG = 5;

function buildBars(active: boolean): number[] {
  return Array.from({ length: BAR_COUNT }, (_, index) =>
    active ? 0.2 + Math.random() * 0.8 : 0.12 + (index % 5) * 0.04,
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildScrapScan(
  analysis: VisionAnalysis,
  weightKg: number,
  valueNgn: number,
  userId: string,
): ScrapScan {
  return {
    id: newId(),
    user_id: userId,
    material_class: analysis.material_class,
    sub_grade: analysis.material_slug,
    weight_est_kg: weightKg,
    estimated_naira_value: valueNgn,
    confidence_score: analysis.confidence,
    toxicity_hazards: analysis.toxicity_hazards,
    safety_instructions: analysis.safety_instructions,
    captured_at: new Date().toISOString(),
    is_synced: false,
    is_deleted: false,
  };
}

export default function BentoDashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const network = useNetworkStatus();
  const { engine, retry } = useEngineStatus();
  const history = useScanHistory(user?.id);
  const voice = useVoiceSafety();
  const { analyze } = useVision();

  const [cameraActive, setCameraActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [currentScan, setCurrentScan] = useState<VisionAnalysis | null>(null);
  const [priceNgnPerKg, setPriceNgnPerKg] = useState(() => defaultPriceFor("other"));

  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG);
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [currency, setCurrency] = useState<Currency>("NGN");

  const [language, setLanguage] = useState<Language>("en");
  const [volume, setVolume] = useState(0.9);
  const [bars, setBars] = useState<number[]>(() => buildBars(false));
  const [filter, setFilter] = useState<HistoryFilter>("all");

  // Animate the visualizer while speaking, settle when idle.
  useEffect(() => {
    if (voice.status !== "speaking") {
      setBars(buildBars(false));
      return;
    }
    const timer = window.setInterval(() => setBars(buildBars(true)), 120);
    return () => window.clearInterval(timer);
  }, [voice.status]);

  // Respect the mute toggle from the network bar.
  useEffect(() => {
    if (!voiceEnabled) voice.stop();
  }, [voiceEnabled, voice.stop]);

  const resolvePrice = useCallback(async (slug: string): Promise<number> => {
    try {
      const category = await getCategoryBySlug(slug);
      if (category?.price_per_kg_naira) return category.price_per_kg_naira;
    } catch {
      // Offline or price matrix unreachable — fall back to the bundled guide.
    }
    return defaultPriceFor(slug);
  }, []);

  const handleCapture = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setScanError(null);
      try {
        const analysis = await analyze(blob);
        const price = await resolvePrice(analysis.material_slug);
        const value = DEFAULT_WEIGHT_KG * price;

        setCurrentScan(analysis);
        setPriceNgnPerKg(price);
        setWeightKg(DEFAULT_WEIGHT_KG);
        setUnit("kg");

        await history.add(
          buildScrapScan(analysis, DEFAULT_WEIGHT_KG, value, user?.id ?? "local"),
        );

        const script = buildSafetyScript(
          {
            materialClass: analysis.material_class,
            hazards: analysis.toxicity_hazards,
            safety: analysis.safety_instructions,
            valuePerKg: price,
          },
          language,
        );
        if (voiceEnabled) voice.speak(script, language, volume);
      } catch (error) {
        setScanError(
          error instanceof Error ? error.message : "Could not analyze that image. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [analyze, resolvePrice, history, user?.id, voice, voiceEnabled, language, volume],
  );

  const guidance: SafetyGuidance | null = currentScan
    ? {
        materialSlug: currentScan.material_slug,
        hazardLevel: currentScan.hazard_level as HazardLevel,
        hazards: currentScan.toxicity_hazards,
        headline: currentScan.material_class,
        instructions: [currentScan.safety_instructions],
      }
    : null;

  const detection: BoundingBox | null = currentScan
    ? {
        x: 0.16,
        y: 0.2,
        width: 0.68,
        height: 0.52,
        label: currentScan.material_class,
        confidence: currentScan.confidence,
      }
    : null;

  const playGuidance = useCallback(() => {
    if (!currentScan) return;
    if (voice.status === "paused") {
      voice.resume();
      return;
    }
    const script = buildSafetyScript(
      {
        materialClass: currentScan.material_class,
        hazards: currentScan.toxicity_hazards,
        safety: currentScan.safety_instructions,
        valuePerKg: priceNgnPerKg,
      },
      language,
    );
    voice.speak(script, language, volume);
  }, [currentScan, voice, priceNgnPerKg, language, volume]);

  return (
    <div className="min-h-screen bg-obsidian-950 bg-bento-mesh text-slate-100">
      <NetworkBar
        network={network}
        engine={engine}
        pendingSync={history.pending}
        syncing={history.syncing}
        lastSyncAt={history.lastSyncAt}
        cameraActive={cameraActive}
        voiceEnabled={voiceEnabled}
        onToggleCamera={() => setCameraActive((value) => !value)}
        onToggleVoice={() => setVoiceEnabled((value) => !value)}
        onSync={() => void history.syncNow()}
        onRetryEngine={retry}
        onExit={() => navigate("/dashboard")}
      />

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Eco-Tech Command Centre
            </h1>
            <p className="text-sm text-slate-400">
              Scan, value and stay safe — fully offline, on any Nigerian phone.
            </p>
          </div>
          {scanError && (
            <p className="rounded-xl border border-eco-red/25 bg-eco-red/10 px-3 py-2 text-xs text-eco-red-glow">
              {scanError}
            </p>
          )}
        </div>

        <BentoGrid>
          <BentoCard
            span={2}
            rowSpan={2}
            gradient="emerald"
            title="Live AI Vision & Scanner"
            subtitle={
              currentScan
                ? `${currentScan.material_class} · ${(currentScan.confidence * 100).toFixed(1)}% confidence`
                : "On-device classification"
            }
            icon={<ScanSearch className="h-4 w-4" />}
            status={cameraActive ? "live" : "pending"}
            statusLabel={cameraActive ? "Scanning" : "Idle"}
          >
            <ScannerModule
              active={cameraActive}
              onActiveChange={setCameraActive}
              onCapture={(blob) => void handleCapture(blob)}
              detection={detection}
              busy={busy}
            />
          </BentoCard>

          <BentoCard
            span={2}
            gradient="lime"
            title="Scrap Market & Valuation"
            subtitle="Live rate · editable weight"
            icon={<Wallet className="h-4 w-4" />}
            status="online"
            statusLabel="Market"
          >
            <ValuationCard
              materialClass={currentScan?.material_class}
              materialSlug={currentScan?.material_slug}
              subGrade={currentScan?.material_slug}
              confidence={currentScan?.confidence}
              hazards={currentScan?.toxicity_hazards ?? []}
              weightKg={weightKg}
              onWeightKg={setWeightKg}
              unit={unit}
              onUnit={setUnit}
              currency={currency}
              onCurrency={setCurrency}
              priceNgnPerKg={priceNgnPerKg}
            />
          </BentoCard>

          <BentoCard
            span={2}
            title="Voice Safety & Hazard Monitor"
            subtitle="Localized spoken guidance"
            icon={<ShieldCheck className="h-4 w-4" />}
            status={voice.status === "speaking" ? "live" : "pending"}
            statusLabel={voice.status === "speaking" ? "Speaking" : voice.status}
          >
            <VoiceSafetyCard
              guidance={guidance}
              languages={SAFETY_LANGUAGES}
              language={language}
              onLanguage={setLanguage}
              volume={volume}
              onVolume={setVolume}
              status={voice.status}
              enabled={voiceEnabled}
              supported={voice.supported}
              bars={bars}
              onPlay={playGuidance}
              onPause={voice.pause}
              onStop={voice.stop}
            />
          </BentoCard>

          <BentoCard
            span={4}
            gradient="cyan"
            title="Offline Activity & Scan History"
            subtitle="Stored on your device · synced to the cloud"
            icon={<Cpu className="h-4 w-4" />}
            status={history.pending > 0 ? "pending" : "online"}
            statusLabel={history.pending > 0 ? `${history.pending} queued` : "All synced"}
          >
            <ScanHistoryTable
              records={history.records}
              filter={filter}
              onFilter={setFilter}
              onSync={() => void history.syncNow()}
              onClear={() => void history.clear()}
              syncing={history.syncing}
              lastSyncAt={history.lastSyncAt}
              loading={history.loading}
            />
          </BentoCard>
        </BentoGrid>
      </main>
    </div>
  );
}
