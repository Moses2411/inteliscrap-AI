import { useApp } from "../../store/appStore";
import type { Language } from "../../types";

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
  { value: "pcm", label: "Pidgin" },
];

export default function Header() {
  const { is_online, selected_language, setSelectedLanguage } = useApp();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
            IS
          </span> */}
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-lg font-bold tracking-tight text-gray-900">
              Inteli<span className="text-brand-600">Scrap</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-700">
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.85 5.7H20l-4.9 3.56L16.9 17 12 13.44 7.1 17l1.8-5.74L4 7.7h6.15z" />
              </svg>
              AI
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative">
            <select
              value={selected_language}
              onChange={(e) => setSelectedLanguage(e.target.value as Language)}
              aria-label="Select language"
              className="appearance-none rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-7 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <div
            className="flex items-center gap-1.5 rounded-full bg-gray-50 py-1.5 pl-2 pr-2.5"
            title={is_online ? "Online" : "Offline"}
          >
            <span className="relative flex h-2 w-2">
              {is_online && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${is_online ? "bg-green-500" : "bg-yellow-500"
                  }`}
              />
            </span>
            <span
              className={`text-[10px] font-semibold ${is_online ? "text-green-700" : "text-yellow-700"
                }`}
            >
              {is_online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}