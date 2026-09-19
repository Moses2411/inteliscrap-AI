import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  RefreshCw,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { ActivityFeed, type ActivityItem } from "../../components/ui/ActivityFeed";
import { AreaChart } from "../../components/charts/AreaChart";
import { Sparkline } from "../../components/charts/Sparkline";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { fetchActivePickups, fetchOffers, type PickupJob, type PickupOffer } from "../../services/pickups";
import { shareMyLocation } from "../../services/location";
import { DEMO_JOBS, DEMO_OFFERS, DEMO_COLLECTOR_INCOME, previewEnabled } from "../../lib/demoData";
import { formatCompactNaira, formatNaira } from "../../utils/formatters";
import { getSavedPhone } from "../../services/auth";
import { cn } from "../../lib/cn";

function distanceLabel(m?: number): string {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function CollectorDashboard() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<PickupOffer[]>([]);
  const [jobs, setJobs] = useState<PickupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [locBusy, setLocBusy] = useState(false);
  const [isPreview, setPreview] = useState(false);
  const phone = getSavedPhone();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, j] = await Promise.all([fetchOffers(), fetchActivePickups()]);
      setOffers(o);
      setJobs(j);
      setPreview(false);
    } catch {
      if (previewEnabled()) {
        setOffers(DEMO_OFFERS);
        setJobs(DEMO_JOBS as PickupJob[]);
        setPreview(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshLocation() {
    setLocBusy(true);
    try {
      await shareMyLocation();
      await load();
    } catch {
      /* best-effort */
    } finally {
      setLocBusy(false);
    }
  }

  const jobsValue = jobs.reduce((acc, j) => acc + (j.estimated_value_naira ?? 0), 0);
  const income = DEMO_COLLECTOR_INCOME;
  const incomeDelta =
    income.length >= 2 ? ((income[income.length - 1] - income[income.length - 2]) / income[income.length - 2]) * 100 : 0;

  const activities: ActivityItem[] = [
    ...jobs
      .filter((j) => j.status === "accepted")
      .map((j) => ({
        id: `a_${j.pickup_id}`,
        tone: "brand" as const,
        icon: <PackageCheck className="h-4 w-4" />,
        title: `Offer accepted — ${j.material_name}`,
        meta: `${j.estimated_weight_kg ?? "—"} kg · ${j.address_text ?? ""}`,
        time: j.accepted_at ?? undefined,
      })),
    ...jobs
      .filter((j) => j.status === "scheduled")
      .map((j) => ({
        id: `s_${j.pickup_id}`,
        tone: "sky" as const,
        icon: <Truck className="h-4 w-4" />,
        title: `Scheduled pickup — ${j.material_name}`,
        meta: j.address_text ?? "",
        time: j.accepted_at ?? undefined,
      })),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Hello, ${phone?.replace("+", "") ?? "Collector"} 👋`}
        subtitle="Track offers, manage pickups and grow your earnings."
        actions={
          <div className="flex items-center gap-2">
            {isPreview && <PreviewPill />}
            <Button variant="secondary" size="sm" onClick={refreshLocation} loading={locBusy}>
              {locBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Navigation className="h-3.5 w-3.5" />
              )}
              Refresh location
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Earnings (30d)"
          value={isPreview ? formatCompactNaira(153000) : "—"}
          icon={<Wallet className="h-5 w-5" />}
          trend={incomeDelta}
          trendLabel="vs last month"
        >
          {isPreview && (
            <div className="mt-3">
              <Sparkline values={income} />
            </div>
          )}
        </StatCard>

        <StatCard
          label="Open offers"
          value={loading ? "—" : offers.length}
          icon={<Sparkles className="h-5 w-5" />}
          iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
          hint={offers.length ? "nearby demand" : "none right now"}
        />

        <StatCard
          label="Active jobs"
          value={loading ? "—" : jobs.length}
          icon={<Truck className="h-5 w-5" />}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
          hint={jobs.length ? `${jobs.filter((j) => j.status === "scheduled").length} scheduled` : "no jobs yet"}
        />

        <StatCard
          label="Job value"
          value={loading ? "—" : formatCompactNaira(jobsValue)}
          icon={<Banknote className="h-5 w-5" />}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300"
          hint="locked in pickups"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Offers */}
        <div className="space-y-4 lg:col-span-3">
          <Card pad>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Offers near you</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dispatched by hex-grid around your location
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/pickups")}>
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : offers.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-6 w-6" />}
                title="No offers right now"
                subtitle="Refresh your location to re-enter the dispatch ring."
              />
            ) : (
              <ul className="space-y-2.5">
                {offers.slice(0, 4).map((offer) => (
                  <li key={offer.pickup_id}>
                    <button
                      onClick={() => navigate("/pickups")}
                      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition-all hover:border-brand-200 hover:bg-brand-50/40 dark:border-slate-800 dark:hover:border-brand-900 dark:hover:bg-brand-950/30"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                          {offer.material_name}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {offer.estimated_weight_kg != null && `${offer.estimated_weight_kg} kg · `}
                          {distanceLabel(offer.distance_m)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-brand-600 dark:text-brand-400">
                        {offer.estimated_value_naira != null ? formatNaira(offer.estimated_value_naira) : "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card pad>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">My pickups</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/my-pickups")}>
                Details <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {activities.length ? (
              <ActivityFeed items={activities} />
            ) : (
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title="No active pickups"
                subtitle="Accept an offer to start your first job."
              />
            )}
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4 lg:col-span-2">
          <Card pad className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-gold-400" />
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Earnings trend</h2>
              {isPreview ? (
                <PreviewPill />
              ) : (
                <Badge tone="slate">lives after settlement</Badge>
              )}
            </div>

            {isPreview ? (
              <>
                <p className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {formatNaira(income[income.length - 1])}
                  <span className="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    this week
                  </span>
                </p>
                <AreaChart
                  labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]}
                  series={[{ name: "Earnings", values: income, color: "var(--c-brand)" }]}
                  height={170}
                  formatValue={(v) => `₦${v.toLocaleString()}`}
                />
              </>
            ) : (
              <EmptyState
                icon={<Banknote className="h-6 w-6" />}
                title="Trends appear after settlements"
                subtitle="Deliveries you complete are summarised into your weekly earnings chart."
              />
            )}
          </Card>

          <Card gradient pad>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                <RefreshCw className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">Stay in the dispatch ring</p>
                <p className="text-xs text-brand-100">Your location keeps offers coming</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              className="!mt-4 bg-white/95"
              onClick={refreshLocation}
              loading={locBusy}
            >
              {locBusy ? "Sharing location…" : "Refresh my location"}
            </Button>
          </Card>

          <Card pad className={cn("flex items-start justify-between gap-3")}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tips</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Lead-acid batteries pay 3× steel per kg
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Always wear gloves — corrosive acid is a listed hazard.
              </p>
            </div>
            <span className="text-xl" aria-hidden="true">🧤</span>
          </Card>
        </div>
      </div>
    </div>
  );
}