import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Camera, LineChart, PiggyBank, Recycle, ScanLine, TrendingUp } from "lucide-react";
import { PageHeader, SectionHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { ActivityFeed, type ActivityItem } from "../../components/ui/ActivityFeed";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageMotion, pageItem, pageStagger } from "../../components/ui/PageMotion";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMarketData } from "../../hooks/useDashboardData";
import { useTranslation } from "../../hooks/useTranslation";
import { getLocalScans } from "../../services/db";
import { formatNairaEstimate, formatPhoneDisplay } from "../../utils/formatters";
import { getSavedPhone } from "../../services/auth";
import type { ScrapScan } from "../../types";

export default function HouseholdDashboard() {
  const navigate = useNavigate();
  const { locale } = useTranslation();
  const market = useMarketData();
  const [scans, setScans] = useState<ScrapScan[]>([]);
  const phone = getSavedPhone();
  const greeting =
    locale === "ha" ? "Sannu" : locale === "pcm" ? "How far" : "Welcome back";
  const displayName = formatPhoneDisplay(phone) ?? "seller";

  useEffect(() => {
    getLocalScans().then(setScans).catch(() => {});
  }, []);

  const scannedValue = scans.reduce((acc, s) => acc + (s.estimated_naira_value || 0), 0);
  const activeListings = market.data?.listings.filter((l) => l.status === "active" || l.status === "matched").length ?? 0;
  const topMaterials = [...(market.data?.materials ?? [])]
    .sort((a, b) => b.price_per_kg_naira - a.price_per_kg_naira)
    .slice(0, 5);

  const activities: ActivityItem[] = scans.slice(0, 5).map((s, i) => ({
    id: s.id,
    tone: (["brand", "amber", "sky", "violet", "rose"] as const)[i % 5],
    icon: <ScanLine className="h-4 w-4" />,
    title: `Scanned ${s.material_class}`,
    meta: formatNairaEstimate(s.estimated_naira_value),
    time: s.captured_at,
  }));

  return (
    <PageMotion className="space-y-6">
      <motion.div variants={pageItem}>
        <PageHeader
          title={`${greeting}, ${displayName} 👋`}
          subtitle="Snap scrap, see the fair price, sell to verified collectors."
          actions={market.isPreview ? <PreviewPill /> : undefined}
        />
      </motion.div>

      {/* Primary scan CTA — the one unmistakable action, placed first so new users see it instantly */}
      <motion.div variants={pageItem}>
        <motion.button
          type="button"
          onClick={() => navigate("/scan")}
          aria-label="Scan scrap — start here"
          initial="rest"
          animate="rest"
          whileHover="hover"
          whileTap="tap"
          variants={{
            rest: { y: 0 },
            hover: { y: -3, transition: { type: "spring", stiffness: 380, damping: 24 } },
            tap: { scale: 0.985, transition: { duration: 0.12 } },
          }}
          className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-teal-600 p-1.5 text-left shadow-card-lg ring-1 ring-brand-400/30 dark:from-brand-700 dark:via-brand-600 dark:to-teal-700 dark:ring-brand-500/30"
        >
          {/* soft glow blob */}
          <motion.div
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.2, transition: { type: "spring", stiffness: 260, damping: 20 } },
            }}
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
            {/* attention-drawing icon tile */}
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
              <Camera className="h-7 w-7" aria-hidden="true" />
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-white/40 motion-safe:animate-pulse-ring"
                aria-hidden="true"
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold tracking-tight text-white sm:text-xl">Scan your scrap now</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-emerald-50">
                Point your camera — on-device AI names the material, flags hazards and shows the fair Naira price, even offline.
              </p>
            </div>

            {/* dominant, high-contrast action pill */}
            <motion.span
              variants={{
                rest: { scale: 1 },
                hover: { scale: 1.05, transition: { type: "spring", stiffness: 400, damping: 18 } },
              }}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-lg sm:w-auto"
            >
              Start scanning <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          </div>
        </motion.button>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Scans this device"
            value={scans.length}
            icon={<ScanLine className="h-5 w-5" />}
            hint="Offline-safe, saved locally"
          />
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Scanned value"
            value={formatNairaEstimate(scannedValue)}
            icon={<PiggyBank className="h-5 w-5" />}
            iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
            hint="At current rates"
          />
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Active listings"
            value={market.loading ? "—" : activeListings}
            icon={<LineChart className="h-5 w-5" />}
            iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
            hint="On the market board"
          />
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Live material rates"
            value={market.loading ? "—" : topMaterials.length}
            icon={<TrendingUp className="h-5 w-5" />}
            iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300"
            hint="Material prices tracked"
          />
        </motion.div>
      </motion.div>

      <motion.div variants={pageItem} className="grid gap-6 lg:grid-cols-5">
        {/* Left: scan history + focus */}
        <div className="flex h-full flex-col gap-4 lg:col-span-3">
          <Card pad className="flex flex-1 flex-col">
            <SectionHeader
              title="Recent scans"
              className="mb-3"
              action={
                scans.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                    History <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : undefined
              }
            />
            {activities.length ? (
              <div className="flex-1">
                <ActivityFeed items={activities} />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={<ScanLine className="h-6 w-6" strokeWidth={1.5} />}
                  title="No scans yet"
                  subtitle="Snap a photo of any scrap material to begin."
                  className="w-full py-8"
                  action={
                    <Button size="sm" onClick={() => navigate("/scan")}>
                      <Camera className="h-3.5 w-3.5" /> Scan scrap
                    </Button>
                  }
                />
              </div>
            )}
          </Card>
        </div>

        {/* Right: price guide + sell */}
        <div className="flex h-full flex-col gap-4 lg:col-span-2">
          <Card pad className="flex flex-1 flex-col">
            <SectionHeader
              title="Best rates today"
              className="mb-3"
              action={
                market.isPreview ? (
                  <PreviewPill />
                ) : (
                  <Badge tone="green">
                    <motion.span
                      className="badge-dot bg-emerald-500"
                      animate={{ opacity: [1, 0.35, 1] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                      aria-hidden="true"
                    />
                    live
                  </Badge>
                )
              }
            />

            <div className="pb-4">
              {market.loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : (
                <ul className="space-y-1">
                  {topMaterials.map((m) => (
                    <li key={m.id}>
                      <motion.button
                        type="button"
                        onClick={() => navigate("/market?tab=prices")}
                        initial="rest"
                        animate="rest"
                        whileHover="hover"
                        variants={{
                          rest: { backgroundColor: "rgba(148,163,184,0)" },
                          hover: { backgroundColor: "rgba(148,163,184,0.1)", transition: { duration: 0.18 } },
                        }}
                        className="group flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {m.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
                            {formatNairaEstimate(m.price_per_kg_naira)}
                            <span className="ml-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">/kg</span>
                          </span>
                          <motion.span
                            variants={{
                              rest: { opacity: 0, x: -4 },
                              hover: { opacity: 1, x: 0, transition: { duration: 0.18 } },
                            }}
                            className="text-slate-500 group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-brand-400"
                            aria-hidden="true"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </motion.span>
                        </span>
                      </motion.button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button variant="secondary" size="sm" fullWidth className="mt-auto" onClick={() => navigate("/market?tab=prices")}>
              Full price guide <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Card>

          <Card gradient pad className="shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Recycle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">Sell to a hub directly</p>
                <p className="text-xs text-brand-100">Your scrap feeds the circular economy.</p>
              </div>
            </div>
            <Button variant="white" size="sm" fullWidth className="!mt-4" onClick={() => navigate("/market")}>
              Open the market
            </Button>
          </Card>
        </div>
      </motion.div>
    </PageMotion>
  );
}