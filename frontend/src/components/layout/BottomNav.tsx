import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, LayoutDashboard, Settings, Store } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import { getRole } from "../../services/auth";
import { getPrimaryRolePage } from "../../lib/nav";
import { cn } from "../../lib/cn";

export default function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();
  const primary = getPrimaryRolePage(role);

  const isActive = (path: string) =>
    location.pathname === path || (path === "/dashboard" && location.pathname === "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pb-[env(safe-area-inset-bottom)]">
        <Tab
          active={isActive("/dashboard")}
          icon={<LayoutDashboard className="h-[22px] w-[22px]" strokeWidth={activeStroke(isActive("/dashboard"))} />}
          label={t("nav_dashboard")}
          onClick={() => navigate("/dashboard")}
        />

        <Tab
          active={isActive("/market")}
          icon={<Store className="h-[22px] w-[22px]" strokeWidth={activeStroke(isActive("/market"))} />}
          label={t("nav_market")}
          onClick={() => navigate("/market")}
        />

        {/* Center scan button */}
        <div className="flex flex-col items-center pb-1.5 pt-2">
          <button
            onClick={() => navigate("/scan")}
            aria-label={t("nav_scan")}
            className={cn(
              "-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-card-lg transition-all duration-150 active:scale-95",
              isActive("/scan")
                ? "bg-brand-700 ring-4 ring-brand-200 dark:ring-brand-900"
                : "bg-gradient-to-br from-brand-500 to-brand-700",
            )}
          >
            <Camera className="h-6 w-6" strokeWidth={2} />
          </button>
          <span
            className={cn(
              "mt-1 text-[10px] font-bold",
              isActive("/scan") ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400",
            )}
          >
            {t("nav_scan")}
          </span>
        </div>

        <Tab
          active={primary != null && isActive(primary.path)}
          icon={primary ? <primary.icon className="h-[22px] w-[22px]" strokeWidth={primary && isActive(primary.path) ? 2.2 : 1.8} /> : <span />}
          label={primary ? t(primary.labelKey) : ""}
          onClick={() => primary && navigate(primary.path)}
        />

        <Tab
          active={isActive("/settings")}
          icon={<Settings className="h-[22px] w-[22px]" strokeWidth={activeStroke(isActive("/settings"))} />}
          label={t("nav_settings")}
          onClick={() => navigate("/settings")}
        />
      </div>
    </nav>
  );
}

function activeStroke(active: boolean): number {
  return active ? 2.2 : 1.8;
}

function Tab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 pb-1.5 pt-2 text-[10px] font-bold transition-colors",
        active
          ? "text-brand-600 dark:text-brand-400"
          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
      )}
    >
      {icon}
      {label}
    </button>
  );
}