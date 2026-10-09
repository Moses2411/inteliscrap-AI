import { Link } from "react-router-dom";
import { Recycle } from "lucide-react";


export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Recycle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              InteliScrap AI
            </p>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Every bottle has a second life.
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
          <Link to="/login" className="transition-colors hover:text-brand-600 dark:hover:text-brand-400">
            Get started
          </Link>
        </nav>
      </div>

      <p className="pb-8 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
        © 2026 IntelliScrap AI · Built with 🤍 for informal recyclers · IntelliScrap AI
      </p>
    </footer>
  );
}
