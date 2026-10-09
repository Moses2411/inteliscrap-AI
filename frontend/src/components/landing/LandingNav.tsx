import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { Menu, Moon, Recycle, Sun, X } from "lucide-react";
import { Button } from "../ui/Button";
import { useApp } from "../../store/appStore";

const LINKS = [
  { href: "#why", label: "Why IntelliScrap" },
  { href: "#promises", label: "Four promises" },
  { href: "#proof", label: "Proof" },
];

const PILL_SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const;

export default function LandingNav() {
  const { theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();

  /* While a click-initiated smooth scroll runs, scroll-spy stays quiet so the pill doesn't flicker. */
  const lockUntil = useRef(0);

  /* ── Scroll-spy: the last section whose top has crossed 40% of the viewport is active ── */
  useEffect(() => {
    const ids = LINKS.map((l) => l.href.slice(1));
    let raf = 0;

    const compute = () => {
      raf = 0;
      if (Date.now() < lockUntil.current) return;
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = `#${id}`;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Close the mobile menu with Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const el = document.getElementById(href.slice(1));
    if (!el) return; // let the browser handle it
    e.preventDefault();
    lockUntil.current = Date.now() + 900;
    setActive(href);
    setOpen(false);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", href);
  };

  const pillTransition = reduce ? { duration: 0 } : PILL_SPRING;

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <div className="relative mx-auto w-full max-w-5xl">
        {/* ── Floating glass bar ── */}
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3 shadow-lg shadow-brand-600/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/30 sm:px-4 sm:py-3.5">
          {/* Brand */}
          <a
            href="#top"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
              <Recycle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                InteliScrap AI
              </span>
              <span className="hidden text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:block">
                Circular economy marketplace
              </span>
            </span>
          </a>

          {/* Actions: nav pill track + controls */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <nav
              aria-label="Primary"
              className="hidden items-center gap-0.5 rounded-xl bg-slate-100/80 p-1 ring-1 ring-inset ring-slate-200/70 dark:bg-white/5 dark:ring-white/10 md:flex"
            >
              {LINKS.map((l) => {
                const isActive = active === l.href;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => go(e, l.href)}
                    aria-current={isActive ? "location" : undefined}
                    className={`relative rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive
                        ? "text-white"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                      }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill-desktop"
                        transition={pillTransition}
                        className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_6px_18px_-6px] shadow-brand-500/60"
                      />
                    )}
                    <span className="relative z-10">{l.label}</span>
                  </a>
                );
              })}
            </nav>

            <span
              className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-white/10 md:block"
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
              className="btn-icon"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Button href="/login" variant="primary" size="sm">
              Get started
            </Button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="btn-icon md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* Scroll-progress hairline */}
          {/* <motion.span
            aria-hidden="true"
            style={{ scaleX: reduce ? scrollYProgress : progress }}
            className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-brand-500 to-brand-700"
          /> */}
        </div>

        {/* ── Mobile panel ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              id="mobile-nav"
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 right-0 top-full mt-2 origin-top rounded-2xl border border-slate-200/70 bg-white/90 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90 md:hidden"
            >
              <nav aria-label="Mobile" className="flex flex-col gap-1">
                {LINKS.map((l) => {
                  const isActive = active === l.href;
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={(e) => go(e, l.href)}
                      aria-current={isActive ? "location" : undefined}
                      className={`relative flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive
                          ? "text-white"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill-mobile"
                          transition={pillTransition}
                          className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_6px_18px_-6px] shadow-brand-500/60"
                        />
                      )}
                      <span className="relative z-10">{l.label}</span>
                    </a>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}