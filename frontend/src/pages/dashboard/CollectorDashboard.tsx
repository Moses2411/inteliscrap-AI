import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  HardHat,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageMotion, pageItem, pageStagger } from "../../components/ui/PageMotion";
import { fetchActivePickups, fetchOffers, type PickupJob, type PickupOffer } from "../../services/pickups";
import { shareMyLocation, getCurrentPosition } from "../../services/location";
import { DEMO_JOBS, DEMO_OFFERS, DEMO_COLLECTOR_INCOME, previewEnabled } from "../../lib/demoData";
import { formatCompactNaira, formatCompactNairaEstimate, formatPhoneDisplay } from "../../utils/formatters";
import { getSavedPhone } from "../../services/auth";
import { cn } from "../../lib/cn";
import { initCollectorNotifications, notifyNewOffer, registerOffersSync } from "../../services/notifications";

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
    // Initialize notifications for collector role
    initCollectorNotifications();
    // Register background sync for offers
    registerOffersSync();

    // Auto-fetch location if not already set (for dispatch to work)
    const ensureLocation = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("inteliscrap_token")}` },
        });
        if (res.ok) {
          const user = await res.json();
          if (!user.latitude || !user.longitude) {
            // Try to get location silently
            const coords = await getCurrentPosition().catch(() => null);
            if (coords) await shareMyLocation();
          }
        }
      } catch {
        // Ignore - user can manually refresh location
      }
    };
    ensureLocation();
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

  // Listen for new offers from background sync
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "OFFERS_SYNCED" && event.data.offers) {
        const newOffers = event.data.offers as PickupOffer[];
        // Check for new offers not in current state
        newOffers.forEach((offer) => {
          if (!offers.some((o) => o.pickup_id === offer.pickup_id)) {
            notifyNewOffer(offer);
          }
        });
        setOffers(newOffers);
      }
      if (event.data.type === "PICKUPS_SYNCED" && event.data.pickups) {
        setJobs(event.data.pickups);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [offers]);

  const jobsValue = jobs.reduce((acc, j) => acc + (j.estimated_value_naira ?? 0), 0);
  const income = DEMO_COLLECTOR_INCOME;
  const incomeDelta =
    income.length >= 2 ? ((income[income.length - 1] - income[income.length - 2]) / income[income.length - 2]) * 100 : 0;

  return (
    <PageMotion className="space-y-6">
      <motion.div variants={pageItem}>
        <PageHeader
          title={`Hello, ${formatPhoneDisplay(phone) ?? "Collector"} 👋`}
          subtitle="Track offers, manage pickups and grow your earnings."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
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
      </motion.div>

      {/* KPI row */}
      <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Earnings (30d)"
            value={isPreview ? formatCompactNaira(153000) : "—"}
            icon={<Wallet className="h-5 w-5" />}
            trend={incomeDelta}
            trendLabel="vs last month"
          >

          </StatCard>
        </motion.div>

        <motion.div variants={pageItem}>
          <StatCard
            label="Active jobs"
            value={jobs.length}
            icon={<Truck className="h-5 w-5" />}
            iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
          />
        </motion.div>

        <motion.div variants={pageItem}>
          <StatCard
            label="Available offers"
            value={offers.length}
            icon={<PackageCheck className="h-5 w-5" />}
            iconClass="bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300"
          />
        </motion.div>

        <motion.div variants={pageItem}>
          <StatCard
            label="Jobs value"
            value={formatCompactNairaEstimate(jobsValue)}
            icon={<Banknote className="h-5 w-5" />}
            iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
          />
        </motion.div>
      </motion.div>

      {/* Available offers */}
      <motion.div variants={pageItem}>
        <Card pad>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Available offers</h2>
            {offers.length > 0 && (
              <Badge tone="green">{offers.length} new</Badge>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : offers.length > 0 ? (
            <div className="space-y-3">
              {offers.map((offer) => (
                <Card
                  key={offer.pickup_id}
                  hover
                  className="border-l-4 border-brand-500 bg-brand-50/30 dark:bg-brand-950/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300">
                        <PackageCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{offer.material_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {offer.estimated_weight_kg ? `${offer.estimated_weight_kg} kg` : "Weight TBD"} •
                          {offer.estimated_value_naira ? ` ≈ ₦${offer.estimated_value_naira.toLocaleString()}` : ""}
                          {offer.distance_m ? ` • ${distanceLabel(offer.distance_m)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/pickups/${offer.pickup_id}/accept`)}
                        className="whitespace-nowrap"
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<PackageCheck className="h-6 w-6" />}
              title="No offers available"
              subtitle="New pickup offers will appear here when sellers nearby list scrap with location enabled."
              action={
                <Button variant="secondary" size="sm" onClick={() => navigate("/market?tab=listings")}>
                  <Store className="h-3.5 w-3.5" /> Browse all listings on Market
                </Button>
              }
            />
          )}
        </Card>
      </motion.div>

      {/* Active pickups */}
      <motion.div variants={pageItem}>
        <Card pad>
          <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Active pickups</h2>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <Card key={job.pickup_id} hover>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        job.status === "en_route" && "bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300",
                        job.status === "arrived" && "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
                        job.status === "verified" && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300",
                        job.status === "completed" && "bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300",
                      )}>
                        {job.status === "en_route" && <Truck className="h-5 w-5" />}
                        {job.status === "arrived" && <MapPin className="h-5 w-5" />}
                        {job.status === "verified" && <PackageCheck className="h-5 w-5" />}
                        {job.status === "completed" && <HardHat className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{job.material_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {job.address_text ?? "Address not specified"} •
                          {job.estimated_weight_kg ? `${job.estimated_weight_kg} kg` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          job.status === "en_route" ? "sky" :
                          job.status === "arrived" ? "amber" :
                          job.status === "verified" ? "green" :
                          job.status === "completed" ? "brand" : "slate"
                        }
                      >
                        {job.status.replace("_", " ")}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/pickups/${job.pickup_id}`)}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="No active pickups"
              subtitle="Accept an offer to start a pickup job."
            />
          )}
        </Card>
      </motion.div>

      {/* Earnings chart (preview only) */}

    </PageMotion>
  );
}