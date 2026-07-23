import { useEffect, type ReactNode } from "react";
import { useOnlineStatus } from "../../utils/offline";
import { useApp } from "../../store/appStore";
import { useSync } from "../../hooks/useSync";
import { useTranslation } from "../../hooks/useTranslation";
import BottomNav from "./BottomNav";
import Header from "./Header";

interface Props {
  children: ReactNode;
}

export default function AppShell({ children }: Props) {
  const { setOnline } = useApp();
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const { triggerSync } = useSync();

  useEffect(() => {
    setOnline(online);
  }, [online, setOnline]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-20 pt-4">
        {!online && (
          <div className="mb-3 rounded-lg bg-yellow-50 px-3 py-2 text-center text-xs font-medium text-yellow-800 ring-1 ring-yellow-200">
            {t("offline_banner")}
          </div>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
