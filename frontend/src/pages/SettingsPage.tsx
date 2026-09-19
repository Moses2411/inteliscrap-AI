import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Globe,
  Languages,
  LogOut,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Toggle } from "../components/ui/Toggle";
import { Avatar } from "../components/ui/Avatar";
import { useApp } from "../store/appStore";
import { useTranslation } from "../hooks/useTranslation";
import { clearToken, getRole, getSavedPhone, setRole, type UserRole } from "../services/auth";
import { previewEnabled, setPreviewEnabled } from "../lib/demoData";
import { cn } from "../lib/cn";
import type { Language } from "../types";

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
  { value: "pcm", label: "Pidgin (Nigeria)" },
];

const ROLE_OPTIONS: UserRole[] = [
  "household",
  "collector",
  "recycling_hub",
  "ngo",
  "partner",
  "admin",
];

function Row({ icon, title, desc, children }: { icon: ReactNode; title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          {desc && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const { selected_language, setSelectedLanguage, is_online, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const phone = getSavedPhone();
  const role = getRole();

  const [testText, setTestText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(previewEnabled());
  const [allowNotifications] = useState(true);

  const playTest = () => {
    if (!testText.trim() || playing) return;
    setPlaying(true);
    const lang = selected_language === "ha" ? "ha" : "en";
    const audio = document.createElement("audio");
    audio.src = `/api/v1/tts?text=${encodeURIComponent(testText)}&lang=${lang}`;
    audio.style.display = "none";
    audio.onended = () => {
      audio.remove();
      setPlaying(false);
    };
    audio.onerror = () => {
      audio.remove();
      setPlaying(false);
    };
    document.body.appendChild(audio);
    audio.play().catch(() => {
      audio.remove();
      setPlaying(false);
    });
  };

  const placeholderKey = `placeholder_${selected_language}` as const;

  function onPreviewToggle(v: boolean) {
    setPreview(v);
    setPreviewEnabled(v);
    navigate("/dashboard", { replace: true });
  }

  function switchRole(r: UserRole) {
    setRole(r);
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <PageHeader
        title={t("settings")}
        subtitle={t("settings_subtitle")}
        actions={is_online ? <Badge tone="green"><Wifi className="h-3 w-3" /> Online</Badge> : <Badge tone="amber"><WifiOff className="h-3 w-3" /> Offline</Badge>}
      />

      {/* Account */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <Avatar name={phone ?? "Guest"} size="lg" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{phone ?? "Not signed in"}</p>
              <p className="text-xs text-slate-400">
                {role ? `${role.replace("_", " ")} account` : "guest"} ·{" "}
                <span className={is_online ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                  {is_online ? t("online") : t("offline")}
                </span>
              </p>
            </div>
          </div>
          {role && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearToken();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> {t("logout")}
            </Button>
          )}
        </div>
      </Card>

      {/* Appearance + voice */}
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row
            icon={<Moon className="h-4 w-4" />}
            title="Dark mode"
            desc="Easier on the eyes at night, saves battery on AMOLED"
          >
            <Toggle checked={theme === "dark"} onChange={() => toggleTheme()} />
          </Row>

          <Row icon={<Languages className="h-4 w-4" />} title={t("language")} desc="Interface, hazards & voice">
            <select
              value={selected_language}
              onChange={(e) => setSelectedLanguage(e.target.value as Language)}
              aria-label={t("language")}
              className="input !w-36 !py-2 text-xs font-bold"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Row>

          <div className="py-3.5">
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Play className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("test_voice")}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {locale === "ha" ? t("test_voice_hint_ha") : locale === "pcm" ? t("test_voice_hint_pcm") : t("test_voice_hint_en")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={t(placeholderKey)}
              />
              <Button onClick={playTest} disabled={!testText.trim() || playing} loading={playing}>
                <Play className="h-4 w-4" /> Play
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Preview mode */}
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row
            icon={<WandSparkles className="h-4 w-4" />}
            title="Preview dashboard data"
            desc="When the API is unreachable, show sample market & impact data so you can demo every dashboard."
          >
            <Toggle checked={preview} onChange={onPreviewToggle} />
          </Row>
          {preview && (
            <div className="flex items-center gap-3 py-3.5">
              <Badge tone="gold">
                <Sparkles className="h-3 w-3" /> Preview on
              </Badge>
              <p className="text-xs text-slate-400">Sample rows are clearly labelled in every dashboard.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Role switcher (dev/demo) */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Switch workspace</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Preview the dedicated dashboard for each user group — sellers, collectors, hubs, NGOs, PROs and admins.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-xs font-bold capitalize transition-all active:scale-[0.98]",
                role === r
                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-glow dark:bg-brand-950/60 dark:text-brand-300"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600",
              )}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row
            icon={<Globe className="h-4 w-4" />}
            title={t("about")}
            desc={t("team")}
          />
          <Row icon={<UserRound className="h-4 w-4" />} title="Account role" desc={role ?? "none"}>
            <Badge tone="brand">{getRole() ?? "guest"}</Badge>
          </Row>
          <Row
            icon={<Bell className="h-4 w-4" />}
            title="Pickup notifications"
            desc="Collector dispatch & hub demand alerts"
          >
            <Toggle checked={allowNotifications} onChange={() => {}} />
          </Row>
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
          InteliScrap AI v0.1.0 · Offline-first PWA with on-device vision. {t("tagline")} ·
          <span className="ml-1 inline-flex items-center gap-1">
            <Wifi className="h-3 w-3" /> syncs scans when back online
          </span>
        </p>
      </Card>
    </div>
  );
}