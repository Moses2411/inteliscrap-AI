import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  ChevronDown,
  Cpu,
  HardDrive,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { EngineStatus, NetworkStatus } from "../../types/bento";

interface NetworkBarProps {
  network: NetworkStatus;
  engine: EngineStatus;
  pendingSync: number;
  syncing: boolean;
  lastSyncAt?: string;
  cameraActive: boolean;
  voiceEnabled: boolean;
  onToggleCamera: () => void;
  onToggleVoice: () => void;
  onSync: () => void;
  onRetryEngine: () => void;
  onExit: () => void;
}

function qualityLabel(network: NetworkStatus): string {
  if (!network.online) return "Offline";
  if (
    network.effectiveType === "slow-2g" ||
    network.effectiveType === "2g" ||
    (typeof network.downlink === "number" && network.downlink < 0.5)
  ) {
    return "Weak signal";
  }
  return network.effectiveType ? network.effectiveType.replace("-", " ") : "Online";
}

export function NetworkBar({
  network,
  engine,
  pendingSync,
  syncing,
  lastSyncAt,
  cameraActive,
  voiceEnabled,
  onToggleCamera,
  onToggleVoice,
  onSync,
  onRetryEngine,
  onExit,
}: NetworkBarProps) {
  const [showDetails, setShowDetails] = useState(false);
  const online = network.online;
  const engineReady = engine.status === "ready";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-obsidian-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-3 py-2.5 sm:px-6">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="tap-target inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-eco-emerald to-eco-lime text-obsidian-950 shadow-glow-emerald">
              <Cpu className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-white">
                InteliScrap <span className="text-eco-emerald-glow">AI</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                v2.4 · Edge PWA
              </p>
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              online
                ? "border-eco-emerald/25 bg-eco-emerald/10 text-eco-emerald-glow"
                : "border-eco-red/25 bg-eco-red/10 text-eco-red-glow",
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={online ? "on" : "off"}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex"
              >
                {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              </motion.span>
            </AnimatePresence>
            <span className="hidden capitalize sm:inline">{qualityLabel(network)}</span>
            <span className="sm:hidden">{online ? "Online" : "Offline"}</span>
            {online && typeof network.downlink === "number" && (
              <span className="hidden font-mono text-[10px] text-slate-400 md:inline">
                ↓{network.downlink.toFixed(1)}Mbps
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={engine.status === "error" ? onRetryEngine : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              engineReady
                ? "border-eco-cyan/25 bg-eco-cyan/10 text-eco-cyan-glow"
                : engine.status === "initializing"
                  ? "border-eco-amber/25 bg-eco-amber/10 text-eco-amber-glow"
                  : "border-eco-red/25 bg-eco-red/10 text-eco-red-glow",
            )}
            aria-label={`${engine.name}: ${engine.status}`}
          >
            {engine.status === "initializing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Cpu className="h-3.5 w-3.5" />
            )}
            <span className="hidden lg:inline">{engine.name}:</span>
            <span className="capitalize">{engine.status}</span>
            <span className="hidden font-mono text-[10px] uppercase text-slate-400 xl:inline">
              {engine.backend}
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className={cn(
                "tap-target inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors",
                pendingSync > 0
                  ? "border-eco-amber/30 bg-eco-amber/10 text-eco-amber-glow hover:bg-eco-amber/20"
                  : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
              )}
              aria-expanded={showDetails}
              aria-label="Offline storage sync"
            >
              <HardDrive className={cn("h-4 w-4", syncing && "animate-pulse")} />
              <span className="hidden sm:inline">Sync</span>
              <span
                className={cn(
                  "flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 font-mono text-[10px]",
                  pendingSync > 0
                    ? "bg-eco-amber-glow text-obsidian-950"
                    : "bg-white/10 text-slate-300",
                )}
              >
                {pendingSync}
              </span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-obsidian-900/95 p-3 shadow-bento backdrop-blur-xl"
                  role="dialog"
                  aria-label="Sync details"
                >
                  <p className="mb-2 text-xs font-semibold text-slate-200">Offline storage</p>
                  <dl className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <dt>Queued</dt>
                      <dd className="font-mono text-eco-amber-glow">{pendingSync}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Last sync</dt>
                      <dd className="font-mono text-slate-300">
                        {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "never"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={onSync}
                    disabled={syncing || !online}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-eco-emerald px-3 py-2.5 text-xs font-bold text-obsidian-950 transition-colors hover:bg-eco-emerald-glow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onToggleCamera}
            aria-pressed={cameraActive}
            aria-label={cameraActive ? "Turn camera off" : "Turn camera on"}
            className={cn(
              "tap-target inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
              cameraActive
                ? "border-eco-emerald/30 bg-eco-emerald/15 text-eco-emerald-glow"
                : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {cameraActive ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={onToggleVoice}
            aria-pressed={voiceEnabled}
            aria-label={voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}
            className={cn(
              "tap-target inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
              voiceEnabled
                ? "border-eco-cyan/30 bg-eco-cyan/15 text-eco-cyan-glow"
                : "border-white/10 text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            {voiceEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
