import { useApp } from "../../store/appStore";

export default function Header() {
  const { is_online, selected_language } = useApp();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-600">InteliScrap</span>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">
            AI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {selected_language === "ha" ? "Hausa" : "Pidgin"}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${is_online ? "bg-green-500" : "bg-yellow-500"}`}
          />
        </div>
      </div>
    </header>
  );
}
