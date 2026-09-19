import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Camera, LineChart, PiggyBank, Recycle, ScanLine, TrendingUp } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { ActivityFeed, type ActivityItem } from "../../components/ui/ActivityFeed";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMarketData } from "../../hooks/useDashboardData";
import { useTranslation } from "../../hooks/useTranslation";
import { getLocalScans } from "../../services/db";
import { formatNaira } from "../../utils/formatters";
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

  useEffect(() => {
    getLocalScans().then(setScans).catch(() => {});
  }, []);

  const scannedValue = scans.reduce((acc, s) => acc + (s.estimated_naira_value || 0), 0);
  const activeListings = market.data?.listings.filter((l) => l.status === "open" || l.status === "matched").length ?? 0;
  const topMaterials = [...(market.data?.materials ?? [])]
    .sort((a, b) => b.price_per_kg_naira - a.price_per_kg_naira)
    .slice(0, 5);

  const activities: ActivityItem[] = scans.slice(0, 5).map((s, i) => ({
    id: s.id,
    tone: (["brand", "amber", "sky", "violet", "rose"] as const)[i % 5],
    icon: <ScanLine className="h-4 w-4" />,
    title: `Scanned ${s.material_class}`,
    meta: `≈ ${formatNaira(s.estimated_naira_value)}`,
    time: s.captured_at,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${greeting}, ${phone?.replace("+", "") ?? "seller"} 👋`}
        subtitle="Snap scrap, see the fair price, sell to verified collectors."
        actions={
          <div className="flex items-center gap-2">
            {market.isPreview && <PreviewPill />}
            <Button size="sm" onClick={() => navigate("/scan")}>
              <Camera className="h-3.5 w-3.5" />
              Scan scrap
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Scans this device"
          value={scans.length}
          icon={<ScanLine className="h-5 w-5" />}
          hint="offline-safe, saved locally"
        />
        <StatCard
          label="Scanned value"
          value={formatNaira(scannedValue)}
          icon={<PiggyBank className="h-5 w-5" />}
          iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
          hint="at current rates"
        />
        <StatCard
          label="Active listings"
          value={market.loading ? "—" : activeListings}
          icon={<LineChart className="h-5 w-5" />}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
          hint="on the market board"
        />
        <StatCard
          label="Live material rates"
          value={market.loading ? "—" : `${topMaterials.length} materials`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300"
          hint="updated by the market"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: scan history + focus */}
        <div className="space-y-4 lg:col-span-3">
          <button
            onClick={() => navigate("/scan")}
            className="group relative w-full overflow-hidden rounded-2xl p-5 text-left shadow-card-lg transition-transform hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(120deg, #047857 0%, #059669 45%, #0d9488 100%)",
            }}
          >
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-xl transition-transform group-hover:scale-125" />
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <Camera className="h-4 w-4" />
                  Know what your scrap is worth
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-emerald-50">
                  On-device AI tells you the material, the hazards and the fair Naira price — even offline.
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur">
                  Scan now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="hidden h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-white backdrop-blur sm:flex">
                <Recycle className="h-8 w-8" />
              </div>
            </div>
          </button>

          <Card pad>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent scans</h2>
              {scans.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                  History <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {activities.length ? (
              <ActivityFeed items={activities} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
                No scans yet — snap a photo of any scrap material to begin.
              </div>
            )}
          </Card>
        </div>

        {/* Right: price guide + sell */}
        <div className="space-y-4 lg:col-span-2">
          <Card pad>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Best rates today</h2>
              {market.isPreview ? (
                <PreviewPill />
              ) : (
                <Badge tone="green">live</Badge>
              )}
            </div>

            {market.loading ? (
              <div className="space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : (
              <ul className="space-y-1.5">
                {topMaterials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                      {formatNaira(m.price_per_kg_naira)}
                      <span className="ml-0.5 text-[10px] font-medium text-slate-400">/kg</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="secondary" size="sm" fullWidth className="!mt-4" onClick={() => navigate("/market")}>
              Full price guide <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Card>

          <Card gradient pad>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Recycle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">Sell to a hub directly</p>
                <p className="text-xs text-brand-100">Your scrap feeds the circular economy.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" fullWidth className="!mt-4 bg-white/95" onClick={() => navigate("/market")}>
              Open the market
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}