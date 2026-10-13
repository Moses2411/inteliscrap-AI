import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ImagePlus,
  Loader2,
  ScanLine,
  Square,
  SwitchCamera,
  Zap,
} from "lucide-react";
import { cn } from "../../lib/cn";
import {
  cameraTorchSupported,
  captureFrame,
  readFileAsBlob,
  setTorch,
  startCameraWithFacing,
  stopCamera,
} from "../../services/camera";
import type { BoundingBox } from "../../types/bento";

interface ScannerModuleProps {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  onCapture: (blob: Blob) => void;
  detection: BoundingBox | null;
  busy: boolean;
}

export function ScannerModule({
  active,
  onActiveChange,
  onCapture,
  detection,
  busy,
}: ScannerModuleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  // ── Start / stop the stream based on `active` + selected camera ─────────
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    const boot = async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
        const el = videoRef.current;
        if (!el) return;
        const stream = await startCameraWithFacing(el, facing);
        if (cancelled) {
          stopCamera(stream);
          return;
        }
        streamRef.current = stream;
        setTorchAvailable(cameraTorchSupported(stream));
      } catch {
        if (!cancelled) {
          setError("Camera access was blocked or no camera is available.");
          setTorchAvailable(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
      setTorchOn(false);
      setTorchAvailable(false);
      setReady(false);
    };
  }, [active, facing]);

  // ── Apply torch state to the live track ────────────────────────────────
  useEffect(() => {
    if (!torchAvailable) return;
    void setTorch(streamRef.current, torchOn);
  }, [torchOn, torchAvailable]);

  // ── Draw the bounding box overlay whenever a detection changes ─────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !ready) return;
    if (!video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection) return;

    const px = detection.x * canvas.width;
    const py = detection.y * canvas.height;
    const pw = detection.width * canvas.width;
    const ph = detection.height * canvas.height;
    const unit = canvas.width;

    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = Math.max(2, unit * 0.004);
    ctx.shadowColor = "rgba(16,185,129,0.85)";
    ctx.shadowBlur = unit * 0.02;
    ctx.strokeRect(px, py, pw, ph);
    ctx.shadowBlur = 0;

    // corner ticks
    const tick = unit * 0.05;
    ctx.lineWidth = Math.max(3, unit * 0.007);
    ctx.strokeStyle = "#a3e635";
    const corners: Array<[number, number, number, number]> = [
      [px, py + tick, px, py],
      [px, py, px + tick, py],
      [px + pw - tick, py, px + pw, py],
      [px + pw, py, px + pw, py + tick],
      [px + pw, py + ph - tick, px + pw, py + ph],
      [px + pw, py + ph, px + pw - tick, py + ph],
      [px + tick, py + ph, px, py + ph],
      [px, py + ph, px, py + ph - tick],
    ];
    for (const [x1, y1, x2, y2] of corners) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const label = `${detection.label} · ${(detection.confidence * 100).toFixed(1)}%`;
    ctx.font = `600 ${Math.round(unit * 0.03)}px Inter, system-ui, sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const pad = unit * 0.014;
    const barH = unit * 0.05;
    const barY = Math.max(0, py - barH - pad);
    ctx.fillStyle = "rgba(11,15,23,0.86)";
    ctx.fillRect(px, barY, textWidth + pad * 2, barH);
    ctx.fillStyle = "#a3e635";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + pad, barY + barH / 2);
  }, [detection, ready]);

  const capture = useCallback(async () => {
    const el = videoRef.current;
    if (!el || busy) return;
    const blob = await captureFrame(el);
    if (blob) onCapture(blob);
  }, [busy, onCapture]);

  const onFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const blob = await readFileAsBlob(file);
      onCapture(blob);
    },
    [onCapture],
  );

  const switchCamera = useCallback(() => {
    setFacing((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-obsidian-950">
        <video
          ref={videoRef}
          playsInline
          muted
          onLoadedMetadata={() => setReady(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            active ? "opacity-100" : "opacity-0",
          )}
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {active && (
          <div className="bento-scanline top-1/2" aria-hidden="true" />
        )}

        {/* Idle / offline placeholder */}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-eco-emerald-glow">
              <Camera className="h-7 w-7" />
              {!busy && (
                <span className="absolute inset-0 rounded-2xl border border-eco-emerald/40 animate-pulse-ring" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">Live AI vision scanner</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
                Point the rear camera at your scrap. Detection runs on-device — nothing leaves your
                phone until you sync.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onActiveChange(true)}
                className="tap-target inline-flex h-11 items-center gap-2 rounded-xl bg-eco-emerald px-5 text-sm font-bold text-obsidian-950 transition-colors hover:bg-eco-emerald-glow"
              >
                <Camera className="h-4 w-4" /> Start camera
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="tap-target inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
              >
                <ImagePlus className="h-4 w-4" /> Upload photo
              </button>
            </div>
          </div>
        )}

        {/* Camera error */}
        {active && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-obsidian-950/90 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-eco-amber-glow" />
            <p className="text-sm font-semibold text-slate-100">Camera unavailable</p>
            <p className="max-w-xs text-xs text-slate-400">{error}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="tap-target inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-slate-200 hover:bg-white/5"
              >
                <ImagePlus className="h-4 w-4" /> Use a photo
              </button>
              <button
                type="button"
                onClick={() => onActiveChange(false)}
                className="tap-target inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-xs font-semibold text-slate-100 hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Live badges */}
        {active && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <span className="eco-chip border-eco-emerald/30 bg-obsidian-950/70 text-eco-emerald-glow">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
              Live
            </span>
            {detection && (
              <span className="eco-chip border-eco-lime/30 bg-obsidian-950/70 text-eco-lime-glow">
                <ScanLine className="h-3 w-3" />
                {detection.label} {(detection.confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-obsidian-950/70 backdrop-blur-sm">
            <Loader2 className="h-7 w-7 animate-spin text-eco-emerald-glow" />
            <p className="text-xs font-medium text-slate-200">Classifying material…</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {/* Manual controls */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={capture}
          disabled={!active || busy || !!error}
          className="tap-target col-span-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-eco-emerald px-3 text-xs font-bold text-obsidian-950 transition-colors hover:bg-eco-emerald-glow disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Camera className="h-4 w-4" /> Capture
        </button>
        <button
          type="button"
          onClick={() => setTorchOn((v) => !v)}
          disabled={!active || !torchAvailable}
          aria-pressed={torchOn}
          title={torchAvailable ? "Toggle torch" : "Torch not supported on this device"}
          className={cn(
            "tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            torchOn
              ? "border-eco-amber/40 bg-eco-amber/15 text-eco-amber-glow"
              : "border-white/10 text-slate-200 hover:bg-white/5",
          )}
        >
          <Zap className="h-4 w-4" /> Torch
        </button>
        <button
          type="button"
          onClick={switchCamera}
          disabled={!active}
          className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SwitchCamera className="h-4 w-4" /> Flip
        </button>
        {active ? (
          <button
            type="button"
            onClick={() => onActiveChange(false)}
            className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            <Square className="h-4 w-4" /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            <ImagePlus className="h-4 w-4" /> Photo
          </button>
        )}
      </div>
    </div>
  );
}
