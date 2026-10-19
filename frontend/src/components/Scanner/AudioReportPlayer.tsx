import { motion } from "framer-motion";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TtsStatus } from "../../hooks/useAudioTTS";

type TtsProgress = {
  fraction?: number | null;
  [key: string]: unknown;
};

interface Props {
  status: TtsStatus;
  progress?: TtsProgress | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const BAR_DELAYS = [0, 0.18, 0.36, 0.12] as const;

/** Dedicated audio-report section: shows playback state and lets the user pause, resume or stop the read-aloud. */
export function AudioReportPlayer({ status, progress, onStart, onPause, onResume, onStop }: Props) {
  const { t } = useTranslation();
  const active = status === "playing" || status === "paused";

  if (!active) {
    return (
      <div className="card card-pad flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
          aria-hidden="true"
        >
          <Volume2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("listen_to_result")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t("listen_to_result_hint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          aria-label={t("listen_to_result")}
          className="tap-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 active:scale-95"
        >
          <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
        </button>
      </div>
    );
  }

  const playing = status === "playing";
  const fraction = progress?.fraction;
  const determinate = fraction != null && Number.isFinite(fraction);
  const pct = determinate ? Math.max(0, Math.min(1, fraction as number)) * 100 : 0;

  return (
    <div
      role="region"
      aria-label={t("audio_report")}
      className="card card-pad border-brand-200 bg-brand-50/60 ring-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:ring-brand-900/60"
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"
          aria-hidden="true"
        >
          {playing ? (
            <span className="flex h-5 items-end gap-[3px]">
              {BAR_DELAYS.map((delay, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] rounded-full bg-white"
                  style={{ height: "30%" }}
                  animate={playing ? { height: ["30%", "100%", "45%", "85%", "30%"] } : { height: "30%" }}
                  transition={
                    playing
                      ? { repeat: Infinity, duration: 1.1, delay, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                />
              ))}
            </span>
          ) : (
            <Pause className="h-5 w-5" fill="currentColor" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("audio_report")}</p>
          <p className="mt-0.5 text-xs text-brand-700 dark:text-brand-300">
            {playing ? t("listening") : t("pause")}
          </p>
        </div>
      </div>

      {/* Progress bar — determinate when we know playback position, indeterminate otherwise */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-brand-100 dark:bg-brand-900/50"
        role="progressbar"
        aria-label={t("audio_report")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? Math.round(pct) : undefined}
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-200 ease-linear"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="relative h-full w-full">
            <div className="absolute inset-y-0 w-1/3 animate-pulse rounded-full bg-brand-400" />
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {playing ? (
          <button
            type="button"
            onClick={onPause}
            className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-brand-950/60"
          >
            <Pause className="h-4 w-4" /> {t("pause")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-brand-950/60"
          >
            <Play className="h-4 w-4" fill="currentColor" /> {t("continue")}
          </button>
        )}
        <button
          type="button"
          onClick={onStop}
          className="tap-target inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <Square className="h-4 w-4" fill="currentColor" /> {t("stop")}
        </button>
      </div>
    </div>
  );
}
