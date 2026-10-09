import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "../../utils/offline";
import { useApp } from "../../store/appStore";
import { useTranslation } from "../../hooks/useTranslation";
import BottomNav from "./BottomNav";
import Sidebar, { MobileMenuButton } from "./Sidebar";

interface Props {
  children: ReactNode;
}

export default function AppShell({ children }: Props) {
  const { setOnline } = useApp();
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setOnline(online);
  }, [online, setOnline]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-white focus:shadow-card-lg"
      >
        {t("skip_to_content")}
      </a>
      <MobileMenuButton onClick={() => setMobileMenuOpen(true)} expanded={mobileMenuOpen} />
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-16 sm:px-6 md:pb-12 md:pt-4 lg:px-8"
        >
          {!online && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
            >
              <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t("offline_banner")}
            </div>
          )}
          <motion.div
            key={online ? "online" : "offline"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
