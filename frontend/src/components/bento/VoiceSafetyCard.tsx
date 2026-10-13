import { Languages, Pause, Play, ShieldAlert, Square, Volume2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { humanizeHazard } from "../../lib/bentoPricing";
import type { HazardLevel, Language } from "../../types";
import type { SafetyGuidance, VoiceStatus } from "../../types/bento";

interface VoiceSafetyCardProps {
  guidance: SafetyGuidance | null;
  languages: Array<{ value: Language; label: string }>;
  language: Language;
  onLanguage: (language: Language) => void;
  volume: number;
  onVolume: (volume: number) => void;
  status: VoiceStatus;
  enabled: boolean;
  supported: boolean;
  bars: number[];
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

const HAZARD_STYLES: Record<HazardLevel, string> = {
  low: "border-eco-emerald/30 bg-eco-emerald/10 text-eco-emerald-glow",
  medium: "border-eco-amber/30 bg-eco-amber/10 text-eco-amber-glow",
  high: "border-eco-red/30 bg-eco-red/10 text-eco-red-glow",
  critical: "border-eco-red/40 bg-eco-red/15 text-eco-red-glow animate-pulse-soft",
};

export function VoiceSafetyCard({
  guidance,
  languages,
  language,
  onLanguage,
  volume,
  onVolume,
  status,
  enabled,
  supported,
  bars,
  onPlay,
  onPause,
  onStop,
}: VoiceSafetyCardProps) {
  const speaking = status === "speaking";
  const level: HazardLevel = guidance?.hazardLevel ?? "low";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Hazard indicator */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hazard level
          </span>
        </div>
        <span className={cn("eco-chip capitalize", HAZARD_STYLES[level])}>{level}</span>
      </div>

      {/* Audio visualizer */}
      <div
        className="flex h-20 items-end justify-center gap-[3px] rounded-2xl border border-white/10 bg-obsidian-950/60 px-3 py-3"
        aria-hidden="true"
      >
        {bars.map((value, index) => (
          <span
            key={index}
            className={cn("viz-bar", !speaking && "!animate-none")}
            style={{
              height: `${Math.max(10, Math.round(value * 100))}%`,
              animationDelay: `${(index % 7) * 0.09}s`,
              animationPlayState: speaking ? "running" : "paused",
              opacity: enabled ? 1 : 0.35,
            }}
          />
        ))}
      </div>

      {/* Hazard chips */}
      <div className="min-h-[2rem] flex flex-wrap gap-1.5">
        {guidance && guidance.hazards.length > 0 ? (
          guidance.hazards.map((hazard) => (
            <span
              key={hazard}
              className="eco-chip border-eco-red/25 bg-eco-red/10 text-eco-red-glow"
            >
              {humanizeHazard(hazard)}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-500">
            {guidance ? "No specific hazards detected." : "Scan a material for a safety readout."}
          </span>
        )}
      </div>

      {/* Guidance text */}
      <p className="text-sm leading-relaxed text-slate-300">
        {guidance
          ? guidance.instructions.join(" ")
          : "Once a material is detected, localized safety guidance will appear here and can be read aloud."}
      </p>

      {!supported && (
        <p className="rounded-xl border border-eco-amber/20 bg-eco-amber/10 px-3 py-2 text-xs text-eco-amber-glow">
          Voice playback isn't supported on this browser — guidance text is still available.
        </p>
      )}

      {/* Controls */}
      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={speaking ? onPause : onPlay}
            disabled={!supported || !enabled || !guidance}
            className="tap-target inline-flex h-11 items-center gap-2 rounded-xl bg-eco-emerald px-4 text-sm font-bold text-obsidian-950 transition-colors hover:bg-eco-emerald-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            {speaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {speaking ? "Pause" : status === "paused" ? "Resume" : "Play guidance"}
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!supported || status === "idle"}
            className="tap-target inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Stop voice guidance"
          >
            <Square className="h-4 w-4" />
          </button>

          <div className="relative ml-auto">
            <label className="sr-only" htmlFor="voice-language">
              Safety language
            </label>
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              id="voice-language"
              value={language}
              onChange={(event) => onLanguage(event.target.value as Language)}
              className="tap-target h-11 appearance-none rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-8 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-eco-emerald"
            >
              {languages.map((option) => (
                <option key={option.value} value={option.value} className="bg-obsidian-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-eco-emerald"
            aria-label="Voice volume"
          />
          <span className="w-9 shrink-0 text-right font-mono text-xs text-slate-400">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
