import { useState } from "react";
import { useApp } from "../store/appStore";
import { useTranslation } from "../hooks/useTranslation";
import type { Language } from "../types";

const LANG_OPTIONS: { value: Language; label: string; native: string }[] = [
  { value: "en", label: "English", native: "EN" },
  { value: "ha", label: "Hausa", native: "HA" },
  // { value: "pcm", label: "Pidgin (Nigeria)", native: "PCM" },
];

export default function SettingsPage() {
  const { selected_language, setSelectedLanguage, is_online } = useApp();
  const { t } = useTranslation();
  const [testText, setTestText] = useState("");
  const [playing, setPlaying] = useState(false);

  const playTest = () => {
    if (!testText.trim() || playing) return;
    setPlaying(true);

    const lang = selected_language === "ha" ? "ha" : "en";
    const audio = document.createElement("audio");
    audio.src = `/api/v1/tts?text=${encodeURIComponent(testText)}&lang=${lang}`;
    audio.style.display = "none";
    audio.onended = () => { audio.remove(); setPlaying(false); };
    audio.onerror = () => { audio.remove(); setPlaying(false); };
    document.body.appendChild(audio);
    audio.play().catch(() => { audio.remove(); setPlaying(false); });
  };

  const hintKey = `test_voice_hint_${selected_language}` as const;
  const placeholderKey = `placeholder_${selected_language}` as const;

  return (
    <div className="space-y-5 pb-8">
      <div className="px-1">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t("settings")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("settings_subtitle")}</p>
      </div>

      {/* Language + voice test */}
      <div className="card space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            <label className="text-base font-semibold text-gray-900">{t("voice_language")}</label>
          </div>

          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${LANG_OPTIONS.length}, minmax(0, 1fr))` }}>
            {LANG_OPTIONS.map((opt) => {
              const active = selected_language === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedLanguage(opt.value)}
                  aria-pressed={active}
                  className={`group relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-all duration-200 active:scale-95 ${active
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  <span className={`text-xs font-bold tracking-wide ${active ? "text-brand-700" : "text-gray-400"}`}>
                    {opt.native}
                  </span>
                  <span className={`text-sm font-medium leading-tight ${active ? "text-brand-700" : "text-gray-600"}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px w-full bg-gray-100" />

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </span>
            <label className="text-base font-semibold text-gray-900">{t("test_voice")}</label>
          </div>
          <p className="pl-10 text-xs leading-relaxed text-gray-500">{t(hintKey)}</p>

          <div className="flex gap-2 pl-10 sm:pl-0 sm:flex-row">
            <div className="flex-1 pl-0">
              <input
                className="input w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={t(placeholderKey)}
                onKeyDown={(e) => e.key === "Enter" && playTest()}
                aria-label={t("test_voice")}
              />
            </div>
            <button
              onClick={playTest}
              disabled={playing || !testText.trim()}
              aria-busy={playing}
              className="btn-primary flex min-w-[64px] items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {playing ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span className="hidden sm:inline">{t("play")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="card rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${is_online ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
              {is_online ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                  <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              )}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t("connection")}</h3>
              <p className="text-xs text-gray-500">{t("status")}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${is_online ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
              }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${is_online ? "bg-green-500" : "bg-yellow-500"} ${is_online ? "" : "animate-pulse"}`} />
            {is_online ? t("online") : t("offline")}
          </span>
        </div>
      </div>

      {/* About */}
      <div className="card rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-gray-900">{t("about")}</h3>
        </div>
        <div className="space-y-1.5 pl-10 text-sm text-gray-500">
          <p className="font-medium text-gray-700">{t("app_name")} <span className="font-normal text-gray-400">v0.1.0</span></p>
          <p>{t("team")}</p>
          <p className="italic text-gray-400">{t("tagline")}</p>
        </div>
      </div>
    </div>
  );
}