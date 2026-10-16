import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Eye,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  ShieldAlert,
  Truck,
  Weight,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useTranslation } from "../hooks/useTranslation";
import { getToken } from "../services/auth";
import {
  fetchActivePickups,
  readStoredHandoverPin,
  recordHandover,
  regeneratePin,
  storeHandoverPin,
  type PickupJob,
} from "../services/pickups";
import { formatDateTime, formatNairaEstimate } from "../utils/formatters";

const RECORDABLE = new Set(["accepted", "en_route", "arrived", "verified"]);

export default function MyPickupsPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<PickupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setJobs(await fetchActivePickups());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loading"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onShowPin(job: PickupJob) {
    const existing = pins[job.pickup_id] ?? readStoredHandoverPin(job.pickup_id);
    if (existing) {
      setPins((prev) => ({ ...prev, [job.pickup_id]: existing }));
      return;
    }
    setBusyId(job.pickup_id);
    setError(null);
    try {
      const res = await regeneratePin(job.pickup_id);
      storeHandoverPin(job.pickup_id, res.handover_pin);
      setPins((prev) => ({ ...prev, [job.pickup_id]: res.handover_pin }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue a code");
    } finally {
      setBusyId(null);
    }
  }

  async function onRecord(job: PickupJob) {
    const weight = Number.parseFloat(weights[job.pickup_id] ?? "");
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Enter the collected weight in kilograms.");
      return;
    }
    setBusyId(job.pickup_id);
    setError(null);
    try {
      await recordHandover(job.pickup_id, weight);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record handover");
    } finally {
      setBusyId(null);
    }
  }

  const totalValue = jobs.reduce((a, j) => a + (j.estimated_value_naira ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <PageHeader
        title={t("my_jobs")}
        subtitle={`${jobs.length} active job${jobs.length === 1 ? "" : "s"}${
          totalValue ? ` · ${formatNairaEstimate(totalValue)} locked in` : ""
        }`}
        actions={<Badge tone="sky"><Truck className="h-3 w-3" /> {jobs.length}</Badge>}
      />

      {error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label={t("loading")}>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="No active pickups"
          subtitle={t("my_jobs_empty")}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {jobs.map((job) => {
          const hazards = job.toxicity_hazards ?? [];
          const revealedPin = pins[job.pickup_id] ?? readStoredHandoverPin(job.pickup_id);
          const canRecord = RECORDABLE.has(job.status);
          return (
            <Card key={job.pickup_id} hover className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">{job.material_name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {job.address_text ?? "Location on request"}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {job.estimated_weight_kg != null && (
                  <Badge tone="slate">
                    <Weight className="h-3 w-3" aria-hidden="true" /> {job.estimated_weight_kg} kg
                  </Badge>
                )}
                {job.handover_weight_kg != null && (
                  <Badge tone="brand">
                    <Weight className="h-3 w-3" aria-hidden="true" /> {job.handover_weight_kg} kg collected
                  </Badge>
                )}
                {job.estimated_value_naira != null && (
                  <Badge tone="gold">{formatNairaEstimate(job.estimated_value_naira)}</Badge>
                )}
                {hazards.length > 0 && (
                  <Badge tone="red">
                    <ShieldAlert className="h-3 w-3" aria-hidden="true" /> {hazards.length} hazard
                    {hazards.length > 1 ? "s" : ""}
                  </Badge>
                )}
                {job.accepted_at && (
                  <Badge tone="sky">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" /> {formatDateTime(job.accepted_at)}
                  </Badge>
                )}
              </div>

              {/* Proof-of-handover panel */}
              <div className="rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:ring-brand-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Handover code
                  </span>
                  {job.status !== "disputed" && (
                    <button
                      type="button"
                      onClick={() => onShowPin(job)}
                      disabled={busyId === job.pickup_id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-brand-300"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {revealedPin ? "Hide" : "Reveal"}
                    </button>
                  )}
                </div>
                {job.status === "disputed" ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Under review by support — no action needed.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-black tracking-[0.3em] tabular-nums text-brand-800 dark:text-brand-200">
                      {revealedPin ? revealedPin : "• • • • • •"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {job.awaiting_confirmation
                        ? "Waiting for the seller to enter this code."
                        : "Read this to the seller when you collect the scrap."}
                    </p>
                  </>
                )}
              </div>

              {canRecord && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Collected weight (kg)"
                    aria-label={`Collected weight for ${job.material_name}`}
                    className="input h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={weights[job.pickup_id] ?? ""}
                    onChange={(e) =>
                      setWeights((prev) => ({
                        ...prev,
                        [job.pickup_id]: e.target.value.replace(/[^\d.]/g, ""),
                      }))
                    }
                  />
                  <Button
                    onClick={() => onRecord(job)}
                    loading={busyId === job.pickup_id}
                    disabled={busyId != null}
                  >
                    Handed over
                  </Button>
                </div>
              )}

              <div className="mt-auto flex gap-2">
                {job.contact_phone && (
                  <a className="btn-primary h-9 flex-1 px-3 text-[13px]" href={`tel:${job.contact_phone}`}>
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {t("call")}
                  </a>
                )}
                {job.latitude != null && job.longitude != null && (
                  <a
                    className="btn-secondary h-9 flex-1 px-3 text-[13px]"
                    href={`https://www.openstreetmap.org/search?query=${job.latitude},${job.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> {t("directions")}
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}
