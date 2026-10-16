import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  ChevronDown,
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
import { PageHeader, SectionHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Toggle } from "../components/ui/Toggle";
import { Avatar } from "../components/ui/Avatar";
import { PageMotion, pageItem } from "../components/ui/PageMotion";
import { MomoCheckout } from "../components/payments/MomoCheckout";
import { useApp } from "../store/appStore";
import { useTranslation } from "../hooks/useTranslation";
import { clearToken, getRole, getSavedPhone } from "../services/auth";
import { fetchSubscriptionStatus, type SubscriptionStatus } from "../services/subscription";
import { formatPhoneDisplay } from "../utils/formatters";
import { previewEnabled, setPreviewEnabled } from "../lib/demoData";
import type { Language } from "../types";

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
  { value: "pcm", label: "Nigerian Pidgin" },
  { value: "yo", label: "Yoruba" },
  { value: "ig", label: "Igbo" },
];

function Row({ icon, title, desc, children }: { icon: ReactNode; title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
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

function LanguageDropdown({ label }: { label: string }) {
  const { selected_language, setSelectedLanguage } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        wrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANG_OPTIONS.find((l) => l.value === selected_language);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "flex h-10 min-w-36 items-center justify-between gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30",
          "border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700",
          open && "border-brand-400 ring-2 ring-brand-500/20 dark:border-brand-600",
        )}
      >
        <span className="truncate">{current?.label ?? "English"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="listbox"
            aria-label={label}
            className="absolute right-0 top-full z-50 mt-2 min-w-44 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card-lg dark:border-slate-700 dark:bg-slate-800"
          >
            {LANG_OPTIONS.map((l) => {
              const selected = l.value === selected_language;
              return (
                <button
                  key={l.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedLanguage(l.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700",
                  )}
                >
                  <span className="truncate">{l.label}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={2.5} aria-hidden="true" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const { selected_language, is_online, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const phone = getSavedPhone();
  const role = getRole();

  const [testText, setTestText] = useState("");
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(previewEnabled());
  const [allowNotifications, setAllowNotifications] = useState(() => localStorage.getItem("is_notify") !== "0");
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const showSubscription = role === "seller" || role === "collector";

  useEffect(() => {
    if (!showSubscription) return;
    let active = true;
    fetchSubscriptionStatus()
      .then((s) => active && setSubStatus(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [showSubscription]);

  function onNotifyToggle(v: boolean) {
    setAllowNotifications(v);
    localStorage.setItem("is_notify", v ? "1" : "0");
  }

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

  return (
    <PageMotion className="space-y-6 pb-8">
      <motion.div variants={pageItem}>
        <PageHeader
          title={t("settings")}
          subtitle={t("settings_subtitle")}
          actions={is_online ? <Badge tone="green"><Wifi className="h-3 w-3" /> Online</Badge> : <Badge tone="amber"><WifiOff className="h-3 w-3" /> Offline</Badge>}
        />
      </motion.div>

      {/* Account */}
      <motion.div variants={pageItem}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 pt-1">
            <div className="flex items-center gap-3">
              <Avatar name={formatPhoneDisplay(phone) ?? "Guest"} size="lg" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatPhoneDisplay(phone) ?? "Not signed in"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
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
      </motion.div>

      {/* Appearance + voice */}
      <motion.div variants={pageItem}>
        <Card>
          <SectionHeader title="Appearance & voice" className="mb-1" />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <Row
              icon={<Moon className="h-4 w-4" />}
              title="Dark mode"
              desc="Easier on the eyes at night, saves battery on AMOLED"
            >
              <Toggle checked={theme === "dark"} onChange={() => toggleTheme()} />
            </Row>

            <Row icon={<Languages className="h-4 w-4" />} title={t("language")} desc="Interface, hazards & voice">
              <LanguageDropdown label={t("language")} />
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
                  aria-label={t("test_voice")}
                />
                <Button onClick={playTest} disabled={!testText.trim() || playing} loading={playing}>
                  <Play className="h-4 w-4" /> Play
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Preview mode */}
      <motion.div variants={pageItem}>
        <Card>
          <SectionHeader title="Preview mode" className="mb-1" />
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Sample rows are clearly labelled in every dashboard.</p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Account type — fixed to the phone number */}
      <motion.div variants={pageItem}>
        <Card>
          <SectionHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                Account type
              </span>
            }
            subtitle="Your account type is fixed to your phone number and can't be changed. One phone number is one account — this keeps collector, buyer and compliance records trustworthy."
            className="mb-3"
          />
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm font-bold capitalize text-slate-800 dark:text-slate-100">
              {role ? role.replace("_", " ") : "guest"}
            </span>
            <Badge tone="brand" className="ml-auto">
              {role ? "fixed" : "guest"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Need a different account type? Register a separate phone number for it.
          </p>
        </Card>
      </motion.div>

      {/* Subscription */}
      {showSubscription && (
        <motion.div variants={pageItem}>
          <Card>
            <SectionHeader
              title={
                <span className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Subscription
                </span>
              }
              subtitle="Free accounts can post up to 4 listings a week. Quarterly Pro removes the limit."
              className="mb-3"
            />
            {subStatus?.plan === "quarterly" ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Quarterly Pro</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    {subStatus.expires_at
                      ? `Renews ${new Date(subStatus.expires_at).toLocaleDateString()}`
                      : "Active"}
                  </p>
                </div>
                <Badge tone="green">unlimited</Badge>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Free plan</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {subStatus ? `${subStatus.listings_this_week}/${subStatus.weekly_limit} listings this week` : "Weekly listing limit"}
                  </p>
                </div>
                <Button size="sm" variant="gold" onClick={() => setUpgradeOpen(true)}>
                  Upgrade
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* About */}
      <motion.div variants={pageItem}>
        <Card>
          <SectionHeader title="About & app" className="mb-1" />
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
              <Toggle checked={allowNotifications} onChange={onNotifyToggle} />
            </Row>
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            InteliScrap AI v0.1.0 · Offline-first PWA with on-device vision. {t("tagline")} ·
            <span className="ml-1 inline-flex items-center gap-1">
              <Wifi className="h-3 w-3" /> syncs scans when back online
            </span>
          </p>
        </Card>
      </motion.div>

      {showSubscription && (
        <MomoCheckout
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          purpose="user_subscription"
          plan="quarterly"
          amountNaira={2500}
          title="Upgrade to Quarterly Pro"
          description="Unlimited listings for three months. Pay in seconds with MTN MoMo."
          onSuccess={() => {
            setUpgradeOpen(false);
            fetchSubscriptionStatus().then(setSubStatus).catch(() => {});
          }}
        />
      )}
    </PageMotion>
  );
}