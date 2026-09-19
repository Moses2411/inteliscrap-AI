import { Moon, Recycle, Sun } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import { cn } from "../../lib/cn";
import { getRole } from "../../services/auth";

const ROLE_LABEL: Record<string, string> = {
  household: "Seller",
  collector: "Collector",
  recycling_hub: "Recycling Hub",
  ngo: "NGO Partner",
  admin: "Admin",
  partner: "EPR Partner",
};

export default function Header() {
  const { t, locale } = useTranslation();
  const { is_online, theme, toggleTheme, setSelectedLanguage } = useApp();
  const role = getRole();
  const roleName = role ? (ROLE_LABEL[role] ?? "Guest") : "Guest";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Recycle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">InteliScrap</p>
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{roleName}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              "mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex",
              is_online
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
            )}
          >
            <span className={cn("badge-dot", is_online ? "bg-emerald-500" : "bg-amber-400 animate-pulse-soft")} />
            {is_online ? t("online") : t("offline")}
          </span>

          <select
            value={locale}
            onChange={(e) => setSelectedLanguage(e.target.value as "en" | "ha" | "pcm")}
            aria-label={t("language")}
            className="h-8 rounded-lg border-0 bg-transparent px-1 text-xs font-bold text-slate-500 focus:outline-none dark:text-slate-400"
          >
            <option value="en">EN</option>
            <option value="ha">HA</option>
            <option value="pcm">PCM</option>
          </select>

          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
            className="btn-icon !h-8 !w-8"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}