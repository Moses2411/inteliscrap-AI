import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Weight,
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
import { fetchOffers, acceptOffer, type PickupJob, type PickupOffer } from "../services/pickups";
import { shareMyLocation } from "../services/location";

function distanceLabel(m?: number): string {
  if (m == null) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function PickupsPage() {
  const { t } = useTranslation();
  const { selected_language } = useApp();
  const [offers, setOffers] = useState<PickupOffer[]>([]);
  const [accepted, setAccepted] = useState<PickupJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [locBusy, setLocBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      setOffers(await fetchOffers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loading"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!getToken()) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAccept(id: string) {
    setBusyId(id);
    setError(null);
    try {
      setAccepted(await acceptOffer(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loading"));
    } finally {
      setBusyId(null);
    }
  }

  const naira = selected_language === "en" ? "₦" : "N";

  /* ── Accepted confirmation screen ───────────────────────────── */
  if (accepted) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col items-center gap-4 pt-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t("accepted_success")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {accepted.material_name}
              {accepted.estimated_weight_kg != null && ` · ${accepted.estimated_weight_kg} kg`}
            </p>
          </div>
        </div>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <MapPin className="h-4 w-4 text-brand-500" aria-hidden="true" />
            {accepted.address_text ?? "Address on request"}
          </div>
          {accepted.contact_phone && (
            <a className="btn-primary w-full" href={`tel:${accepted.contact_phone}`}>
              <Phone className="h-4 w-4" />
              {t("call")} {accepted.contact_phone}
            </a>
          )}
          {accepted.latitude != null && accepted.longitude != null && (
            <a
              className="btn-secondary w-full"
              href={`https://www.openstreetmap.org/search?query=${accepted.latitude},${accepted.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation className="h-4 w-4" />
              {t("directions")}
            </a>
          )}
        </Card>

        <Button variant="ghost" fullWidth onClick={() => setAccepted(null)}>
          {t("new_pickups")} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  /* ── Offers board ───────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t("new_pickups")}
        subtitle="Live offers dispatched to your hex ring"
        actions={
          <Badge tone="brand">
            <Sparkles className="h-3 w-3" /> {offers.length}
          </Badge>
        }
      />

      <button
        onClick={refresh}
        disabled={locBusy}
        className="group flex w-full items-center justify-between rounded-2xl border border-brand-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.995] dark:border-brand-900 dark:bg-slate-900"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <RefreshCw className={`h-4 w-4 ${locBusy ? "animate-spin" : ""}`} aria-hidden="true" />
          {locBusy ? t("loc_sharing") : t("refresh_location")}
        </span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm group-hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300">
          {distanceLabel(offers[0]?.distance_m)}
        </span>
      </button>

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

      {!loading && !error && offers.length === 0 && (
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
                      {naira}
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
    </div>
  );
}