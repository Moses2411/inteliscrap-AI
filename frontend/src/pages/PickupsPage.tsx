import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
  Weight,
  X,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useTranslation } from "../hooks/useTranslation";
import { useApp } from "../store/appStore";
import { getToken } from "../services/auth";
import {
  acceptOffer,
  fetchHoldStatus,
  fetchOffers,
  isApproxLocation,
  mapLink,
  type HoldStatus,
  type PickupJob,
  type PickupOffer,
} from "../services/pickups";
import { shareMyLocation } from "../services/location";

function distanceLabel(m?: number): string {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function PickupsPage() {
  const { t } = useTranslation();
  const { selected_language } = useApp();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<PickupOffer[]>([]);
  const [accepted, setAccepted] = useState<PickupJob | null>(null);
  const [hold, setHold] = useState<HoldStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [locBusy, setLocBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [nextOffers, nextHold] = await Promise.all([fetchOffers(), fetchHoldStatus()]);
      setOffers(nextOffers);
      setHold(nextHold);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the pickup board");
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLocBusy(true);
    try {
      await shareMyLocation();
    } catch {
      // best-effort: offers still load with last known position
    } finally {
      setLocBusy(false);
    }
    try {
      await loadBoard();
    } finally {
      setLoading(false);
    }
  }, [loadBoard]);

  useEffect(() => {
    if (!getToken()) return;
    void refresh();
    // Keep the board fresh while it is open so freed slots surface offers.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadBoard();
    }, 30_000);
    const onFocus = () => void loadBoard();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, loadBoard]);

  async function onAccept(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const result = await acceptOffer(id);
      setAccepted(result);
      // Refresh capacity and the remaining offers without moving the user
      // away from the board.
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusyId(null);
    }
  }

  const naira = selected_language === "en" ? "₦" : "N";
  const activeJobs = hold?.active_jobs ?? hold?.open_handovers ?? 0;
  const maxJobs = hold?.max_concurrent_jobs ?? 3;
  const remainingSlots = hold?.remaining_slots ?? Math.max(0, maxJobs - activeJobs);
  const atCapacity = hold?.on_hold ?? false;

  /* ── Offers board ───────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <PageHeader
        title={t("new_pickups")}
        subtitle="Live offers dispatched to your hex ring"
        actions={
          <div className="flex items-center gap-2">
            {hold && (
              <Badge tone={atCapacity ? "amber" : "green"}>
                <Truck className="h-3 w-3" /> {activeJobs}/{maxJobs} jobs
              </Badge>
            )}
            <Badge tone="brand">
              <Sparkles className="h-3 w-3" /> {offers.length}
            </Badge>
          </div>
        }
      />

      {accepted && (
        <Card
          role="status"
          aria-live="polite"
          className="border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                {t("accepted_success")}
              </p>
              <p className="mt-0.5 truncate text-xs text-emerald-800/80 dark:text-emerald-200/80">
                {accepted.material_name}
                {accepted.estimated_weight_kg != null && ` · ${accepted.estimated_weight_kg} kg`}
                {accepted.address_text ? ` · ${accepted.address_text}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {accepted.contact_phone && (
                  <Button variant="secondary" size="sm" href={`tel:${accepted.contact_phone}`}>
                    <Phone className="h-3.5 w-3.5" /> {t("call")}
                  </Button>
                )}
                {mapLink(accepted.latitude, accepted.longitude) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    href={mapLink(accepted.latitude, accepted.longitude)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="h-3.5 w-3.5" /> {t("directions")}
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={() => navigate("/my-pickups")}>
                  {t("my_jobs")} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                Head to the seller, record the weight under Jobs, then enter the
                code they give you.
              </p>
              {remainingSlots > 0 && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-300/80">
                  {remainingSlots} job slot{remainingSlots === 1 ? "" : "s"} left — you can
                  accept another offer.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAccepted(null)}
              className="rounded-full p-1.5 text-emerald-700/70 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      <motion.button
        onClick={refresh}
        disabled={locBusy}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="group flex w-full items-center justify-between rounded-2xl border border-brand-200 bg-white px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md dark:border-brand-900 dark:bg-slate-900"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <RefreshCw className={`h-4 w-4 ${locBusy ? "animate-spin" : ""}`} aria-hidden="true" />
          {locBusy ? t("loc_sharing") : t("refresh_location")}
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300">
          {atCapacity ? "Paused" : distanceLabel(offers[0]?.distance_m)}
        </span>
      </motion.button>

      {atCapacity && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:ring-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-amber-800 dark:text-amber-200">
            <p className="text-sm font-bold">All job slots are full</p>
            <p className="text-xs">
              You are working {activeJobs} of {maxJobs} pickups. Finish or confirm one
              to free a slot — new offers pause until then.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => navigate("/my-pickups")}
            >
              {t("my_jobs")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t("loading")}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && offers.length === 0 && !atCapacity && (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No offers right now"
          subtitle={t("pickups_empty")}
        />
      )}

      <ul className="space-y-3">
        {offers.map((offer) => {
          const hazards = offer.toxicity_hazards ?? [];
          return (
            <li key={offer.pickup_id}>
              <Card hover className="overflow-hidden">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300">
                      <Weight className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-slate-900 dark:text-white">{offer.material_name}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {offer.address_text ?? "Location on request"}
                        {isApproxLocation(offer.location_precision) && (
                          <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            approx.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge tone="brand">{distanceLabel(offer.distance_m)}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {offer.estimated_weight_kg != null && (
                    <Badge tone="slate">{offer.estimated_weight_kg} kg</Badge>
                  )}
                  {offer.estimated_value_naira != null && (
                    <Badge tone="gold">
                      ≈ {naira}
                      {offer.estimated_value_naira.toLocaleString()}
                    </Badge>
                  )}
                  {hazards.length > 0 && (
                    <Badge tone="red">
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      {hazards.length} hazard{hazards.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {(offer.contact_phone || mapLink(offer.latitude, offer.longitude)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {offer.contact_phone && (
                      <a
                        href={`tel:${offer.contact_phone}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                        {offer.contact_phone}
                      </a>
                    )}
                    {mapLink(offer.latitude, offer.longitude) && (
                      <a
                        href={mapLink(offer.latitude, offer.longitude)!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                      >
                        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("directions")}
                      </a>
                    )}
                  </div>
                )}

                <Button
                  className="!mt-4 w-full"
                  onClick={() => onAccept(offer.pickup_id)}
                  loading={busyId === offer.pickup_id}
                  disabled={busyId != null}
                >
                  {busyId === offer.pickup_id ? t("accepting") : t("accept")}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}