import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Globe, LogOut, Menu, Moon, Recycle, Search, Sun, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/cn";
import { getNavForRole, ROLE_LABEL } from "../../lib/nav";
import { getRole, clearToken, getSavedPhone } from "../../services/auth";
import { useTranslation } from "../../hooks/useTranslation";
import { useApp } from "../../store/appStore";
import { formatPhoneDisplay } from "../../utils/formatters";
import { Avatar } from "../ui/Avatar";

const LANGS = [
  { code: "en", label: "English" },
  { code: "ha", label: "Hausa" },
  { code: "pcm", label: "Nigerian Pidgin" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
] as const;

const LANG_SHORT: Record<string, string> = { en: "EN", ha: "HA", pcm: "PCM", yo: "YO", ig: "IG" };

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="invisible pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:bg-slate-700"
      role="tooltip"
    >
      {label}
      <div className="absolute -right-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-700" />
    </div>
  );
}

export function MobileMenuButton({ onClick, expanded }: { onClick: () => void; expanded: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      id="mobile-menu-button"
      onClick={onClick}
      className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-card transition-all duration-150 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 md:hidden"
      aria-label={t("expand_sidebar")}
      aria-expanded={expanded}
      aria-controls="mobile-nav-drawer"
    >
      <Menu className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}

interface Props {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: Props) {
  const { t, locale } = useTranslation();
  const { theme, toggleTheme, setSelectedLanguage } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef<HTMLElement>(null);
  const role = getRole();
  const phone = getSavedPhone();
  const userName = formatPhoneDisplay(phone) ?? "Guest";
  const roleName = role ? (ROLE_LABEL[role] ?? "Guest") : "Guest";

  const allItems = getNavForRole(role);
  const items = allItems.filter((item) => item.path !== "/settings");
  const settings = allItems.find((item) => item.path === "/settings");

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });
  const [hoverPeek, setHoverPeek] = useState(false);
  const [query, setQuery] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const expanded = !collapsed || hoverPeek;
  const peekTimer = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const clearPeekTimer = () => {
    if (peekTimer.current !== null) {
      window.clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  };

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    return () => {
      if (peekTimer.current !== null) window.clearTimeout(peekTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        langRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  // Mobile drawer: focus first item on open, Escape closes + restores focus
  useEffect(() => {
    if (!mobileOpen) return;
    const id = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onMobileClose?.();
        document.getElementById("mobile-menu-button")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen, onMobileClose]);

  const handleAsideEnter = () => {
    if (!collapsed) return;
    clearPeekTimer();
    peekTimer.current = window.setTimeout(() => setHoverPeek(true), 300);
  };

  const handleAsideLeave = () => {
    clearPeekTimer();
    setHoverPeek(false);
    setLangOpen(false);
  };

  const handleToggle = () => {
    clearPeekTimer();
    setHoverPeek(false);
    setCollapsed((c) => !c);
  };

  const openSearch = () => {
    clearPeekTimer();
    setHoverPeek(false);
    setCollapsed(false);
    window.setTimeout(() => searchRef.current?.focus(), 60);
  };

  const handleNav = (path: string) => {
    navigate(path);
    onMobileClose?.();
  };

  const isActive = (path: string) =>
    location.pathname === path || (path === "/dashboard" && location.pathname === "/");

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((item) => t(item.labelKey).toLowerCase().includes(q)) : items;

  const rowCls = (active: boolean) =>
    cn(
      "flex h-10 w-full items-center rounded-xl text-sm font-medium transition-all duration-150",
      expanded ? "gap-3 px-2.5" : "justify-center px-0",
      active
        ? "bg-brand-50 font-semibold text-brand-700 shadow-sm dark:bg-brand-950/60 dark:text-brand-300"
        : "text-slate-600 hover:bg-brand-50/60 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-300",
    );

  const sidebarContent = (
    <>
      {/* Brand + Collapse toggle */}
      <div className={cn("flex items-center pb-2 pt-5 transition-all duration-200", expanded ? "gap-2.5 px-4" : "flex-col gap-2 px-3")}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Recycle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div
            className={cn(
              "min-w-0 overflow-hidden whitespace-nowrap leading-tight transition-all duration-200",
              expanded ? "opacity-100" : "w-0 opacity-0"
            )}
          >
            <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">InteliScrap AI</p>
            <p className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{roleName}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={cn(
            "group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300",
            !expanded && "mt-0"
          )}
          aria-label={expanded ? t("collapse_sidebar") : t("expand_sidebar")}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          )}
          {!expanded && <Tooltip label={t("expand_sidebar")} />}
        </button>
      </div>

      {/* Search */}
      {expanded ? (
        <div className="px-2.5 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("sidebar_search")}
              aria-label={t("sidebar_search")}
              className="h-9 w-full rounded-xl border border-transparent bg-slate-100 pl-8 pr-3 text-[13px] font-medium text-slate-700 placeholder:text-slate-400 transition-all duration-150 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-brand-800 dark:focus:bg-slate-800/80"
            />
          </div>
        </div>
      ) : (
        <div className="group relative px-2.5 pb-1.5">
          <button
            onClick={openSearch}
            className="flex h-10 w-full items-center justify-center rounded-xl text-slate-500 transition-all duration-150 hover:bg-brand-50/60 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-400"
            aria-label={t("sidebar_search")}
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <Tooltip label={t("sidebar_search")} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2" aria-label="Primary">
        {filtered.map((item) => {
          const active = isActive(item.path);
          return (
            <div key={item.path} className="group relative">
              <button onClick={() => handleNav(item.path)} className={rowCls(active)} aria-current={active ? "page" : undefined}>
                <item.icon
                  className={cn("h-[18px] w-[18px] shrink-0", active && "text-brand-600 dark:text-brand-400")}
                  strokeWidth={active ? 2.2 : 1.8}
                  aria-hidden="true"
                />
                {expanded && <span className="truncate">{t(item.labelKey)}</span>}
              </button>
              {!expanded && <Tooltip label={t(item.labelKey)} />}
            </div>
          );
        })}
      </nav>

      {/* Theme toggle — own line above Settings */}
      <div className="group relative px-2.5 pb-1">
        <button
          onClick={toggleTheme}
          className={cn(
            "flex h-10 w-full items-center rounded-xl text-sm font-medium transition-all duration-150",
            expanded ? "gap-3 px-2.5" : "justify-center px-0",
            "text-slate-600 hover:bg-brand-50/60 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
          )}
          aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Moon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          )}
          {expanded && <span className="truncate">{theme === "dark" ? "Light" : "Dark"}</span>}
        </button>
        {!expanded && <Tooltip label={theme === "dark" ? "Light mode" : "Dark mode"} />}
      </div>

      {/* Language selector — below Theme, above Settings, dropdown opens to the RIGHT */}
      <div ref={langRef} className="group relative px-2.5 pb-1">
        <button
          onClick={() => setLangOpen((o) => !o)}
          className={cn(
            "flex h-10 w-full items-center rounded-xl text-sm font-medium transition-all duration-150",
            expanded ? "gap-3 px-2.5" : "justify-center px-0",
            "text-slate-600 hover:bg-brand-50/60 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-300",
            langOpen && "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
          )}
          aria-label={t("language")}
          aria-expanded={langOpen}
          aria-haspopup="menu"
        >
          <Globe className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {expanded && (
            <>
              <span className="flex-1 truncate text-left">{LANG_SHORT[locale] ?? "EN"}</span>
              <ChevronRight
                className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", langOpen && "rotate-90")}
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </>
          )}
        </button>
        {!expanded && <Tooltip label={t("language")} />}

        {/* Dropdown anchored to the RIGHT of the sidebar */}
        <AnimatePresence>
          {langOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute top-0 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800",
                expanded ? "left-full ml-2" : "left-full ml-2"
              )}
              role="menu"
              aria-label={t("language")}
            >
              {LANGS.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setSelectedLanguage(lang.code);
                    setLangOpen(false);
                  }}
                  className={cn(
                    "flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors",
                    locale === lang.code
                      ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                  )}
                  role="menuitem"
                >
                  <span>{lang.label}</span>
                  {locale === lang.code && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" strokeWidth={2.5} aria-hidden="true" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings */}
      {settings && (
        <div className="group relative px-2.5 pb-1">
          <button
            onClick={() => handleNav(settings.path)}
            className={rowCls(isActive(settings.path))}
            aria-current={isActive(settings.path) ? "page" : undefined}
          >
            <settings.icon
              className={cn("h-[18px] w-[18px] shrink-0", isActive(settings.path) && "text-brand-600 dark:text-brand-400")}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            {expanded && <span className="truncate">{t(settings.labelKey)}</span>}
          </button>
          {!expanded && <Tooltip label={t(settings.labelKey)} />}
        </div>
      )}

      {/* Logout */}
      <div className="group relative px-2.5 pb-1">
        <button
          onClick={() => {
            clearToken();
            navigate("/login");
            onMobileClose?.();
          }}
          className={cn(
            "flex h-10 w-full items-center rounded-xl text-sm font-medium transition-all duration-150",
            expanded ? "gap-3 px-2.5" : "justify-center px-0",
            "text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          )}
          aria-label={t("logout")}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {expanded && <span className="truncate">{t("logout")}</span>}
        </button>
        {!expanded && <Tooltip label={t("logout")} />}
      </div>

      {/* User card at bottom — display only */}
      <div className="border-t border-slate-100 px-2.5 py-3 dark:border-slate-800">
        <div
          className={cn(
            "flex w-full items-center rounded-xl transition-all duration-150",
            expanded ? "gap-2.5 px-2.5 py-2" : "justify-center px-0 py-1.5"
          )}
        >
          <Avatar name={userName} size="sm" />
          {expanded && (
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{userName}</span>
              <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{roleName}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            ref={drawerRef}
            id="mobile-nav-drawer"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-3 top-3 z-50 flex h-[calc(100vh-1.5rem)] w-64 flex-col rounded-[20px] border border-slate-200/80 bg-white shadow-card-lg dark:border-slate-800 dark:bg-slate-900 md:hidden"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={handleAsideEnter}
        onMouseLeave={handleAsideLeave}
        className={cn(
          "sticky top-3 z-30 m-3 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col rounded-[20px] border border-slate-200/80 bg-white shadow-card-lg transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-800 dark:bg-slate-900 md:flex",
          expanded ? "w-60" : "w-[72px]"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
