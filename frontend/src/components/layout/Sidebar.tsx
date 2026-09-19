import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Recycle } from "lucide-react";
import { cn } from "../../lib/cn";
import { getNavForRole } from "../../lib/nav";
import { getRole, clearToken, getSavedPhone } from "../../services/auth";
import { useTranslation } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import { Avatar } from "../ui/Avatar";

export default function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { is_online } = useApp();
  const role = getRole();
  const phone = getSavedPhone();

  const items = getNavForRole(role);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-card-lg">
          <Recycle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">InteliScrap</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Market &amp; Pickup
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Primary">
        {items.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path === "/dashboard" && location.pathname === "/");
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active && "text-brand-600 dark:text-brand-400")} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              {t(item.labelKey)}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={phone ?? "Collector"} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
              {phone ?? "Guest"}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <span className={cn("badge-dot", is_online ? "bg-emerald-500" : "bg-amber-400")} />
              {is_online ? t("online") : t("offline")}
            </p>
          </div>
          <button
            onClick={() => {
              clearToken();
              navigate("/login");
            }}
            className="btn-icon !h-8 !w-8"
            title={t("logout")}
            aria-label={t("logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}