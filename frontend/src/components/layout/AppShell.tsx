import { useEffect, type ReactNode } from "react";
import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "../../utils/offline";
import { useApp } from "../../store/appStore";
import { useTranslation } from "../../hooks/useTranslation";
import BottomNav from "./BottomNav";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface Props {
  children: ReactNode;
}

export default function AppShell({ children }: Props) {
  const { setOnline } = useApp();
  const { t } = useTranslation();
  const online = useOnlineStatus();

  useEffect(() => {
    setOnline(online);
  }, [online, setOnline]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-12 lg:px-8">
          {!online && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
            >
              <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("offline_banner")}
            </div>
          )}
          <div key={online ? "online" : "offline"} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}