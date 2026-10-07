import { useState } from "react";
import { Menu, Moon, Recycle, Sun, X } from "lucide-react";
import { Button } from "../ui/Button";
import { useApp } from "../../store/appStore";

const LINKS = [
  { href: "#why", label: "Why IntelliScrap" },
  { href: "#promises", label: "Four promises" },
  { href: "#offline", label: "Offline & Hausa-first" },
  { href: "#proof", label: "Proof" },
  { href: "#team", label: "Team" },
];

export default function LandingNav() {
  const { theme, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
            <Recycle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
              InteliScrap AI
            </span>
            <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Circular economy marketplace
            </span>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
            className="btn-icon"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button href="/login" variant="primary" size="sm">
            Log in
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="btn-icon md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
