import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/cn";
import { getToken } from "../../services/auth";
import {
  confirmHandover,
  fetchActivePickups,
  fetchAwaitingConfirmation,
  isApproxLocation,
  recordHandover,
  type PickupJob,
} from "../../services/pickups";
import { formatDateTime, formatNairaEstimate, formatPhoneDisplay } from "../../utils/formatters";

const REFRESH_MS = 15_000;
const COPIED_MS = 1_600;

/** Statuses where the collector can still record the handover weight. */
const RECORDABLE = new Set(["accepted", "en_route", "arrived", "verified"]);

type Mode = "seller" | "collector";

function formatKm(m?: number) {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function statusChip(job: PickupJob, isSeller: boolean) {
  if (job.status === "disputed") {
    return (
      <Badge tone="amber">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Under review
      </Badge>
    );
  }
  if (job.awaiting_confirmation) {
    return (
      <Badge tone="brand">
        <KeyRound className="h-3 w-3" aria-hidden="true" /> Ready to confirm
      </Badge>
    );
  }
  if (job.status === "arrived") {
    return (
      <Badge tone="violet">
        <MapPin className="h-3 w-3" aria-hidden="true" /> {isSeller ? "Collector arrived" : "Arrived"}
      </Badge>
    );
  }
  if (job.status === "en_route") {
    return (
      <Badge tone="sky">
        <Truck className="h-3 w-3" aria-hidden="true" /> On the way
      </Badge>
    );
  }
  return (
    <Badge tone="slate">
      <Check className="h-3 w-3" aria-hidden="true" /> {isSeller ? "Collector assigned" : "Accepted"}
    </Badge>
  );
}

export function JobsListCard({ mode, className }: { mode: Mode; className?: string }) {
  const isSeller = mode === "seller";
  const [jobs, setJobs] = useState<PickupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<Record<string, string | null>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [pins, setPins] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mounted = useRef(true);
  const copiedTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const next = isSeller ? await fetchAwaitingConfirmation() : await fetchActivePickups();
      if (!mounted.current) return;
      setJobs(next);
      setError(null);
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Could not load jobs");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    mounted.current = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
      window.clearTimeout(copiedTimer.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function onCopy(job: PickupJob) {
    const code = job.handover_pin;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    if (!mounted.current) return;
    setCopiedId(job.pickup_id);
    if (navigator.vibrate) navigator.vibrate(10);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => {
      if (mounted.current) setCopiedId(null);
    }, COPIED_MS);
  }

  async function onRecordWeight(job: PickupJob) {
    const weight = Number.parseFloat(weights[job.pickup_id] ?? "");
    if (!Number.isFinite(weight) || weight <= 0) {
      setFormError((prev) => ({ ...prev, [job.pickup_id]: "Enter the weight in kilograms." }));
      return;
    }
    setBusyId(job.pickup_id);
    setFormError((prev) => ({ ...prev, [job.pickup_id]: null }));
    try {
      await recordHandover(job.pickup_id, weight);
      setWeights((prev) => ({ ...prev, [job.pickup_id]: "" }));
      await refresh();
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        [job.pickup_id]: err instanceof Error ? err.message : "Could not record the weight",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmCode(job: PickupJob) {
    const pin = (pins[job.pickup_id] ?? "").trim();
    if (!/^\d{6}$/.test(pin)) {
      setFormError((prev) => ({ ...prev, [job.pickup_id]: "Enter the 6-digit code from the seller." }));
      return;
    }
    setBusyId(job.pickup_id);
    setFormError((prev) => ({ ...prev, [job.pickup_id]: null }));
    try {
      await confirmHandover(job.pickup_id, pin);
      await refresh();
    } catch (err) {
      setFormError((prev) => ({
        ...prev,
        [job.pickup_id]: err instanceof Error ? err.message : "Confirmation failed",
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-14 w-full" />
        <Skeleton className="mt-3 h-14 w-full" />
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className={className}>
        <div className="mb-3 flex items-center gap-2">
          {isSeller ? (
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          ) : (
            <Truck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          )}
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isSeller ? "My accepted jobs" : "My active jobs"}
          </h3>
        </div>
        <EmptyState
          icon={isSeller ? <ShieldCheck className="h-6 w-6" strokeWidth={1.5} /> : <Truck className="h-6 w-6" />}
          title={isSeller ? "No accepted jobs yet" : "No active jobs"}
          subtitle={
            isSeller
              ? "When a collector accepts a listing, it appears here with a code to share at handover."
              : "Accepted jobs appear here so you can record the weight and confirm the handover."
          }
          className="py-6"
        />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="mb-3 flex items-center gap-2">
        {isSeller ? (
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        ) : (
          <Truck className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        )}
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {isSeller ? "My accepted jobs" : "My active jobs"}
        </h3>
        <Badge tone="brand" className="ml-auto">
          {jobs.length} open
        </Badge>
        <button
          type="button"
          onClick={() => refresh()}
          aria-label="Refresh jobs"
          className="btn-icon h-11 w-11 shrink-0"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900"
        >
          {error}
        </div>
      )}

      <ul className="space-y-2.5">
        {jobs.map((job) => {
          const open = openId === job.pickup_id;
          const busy = busyId === job.pickup_id;
          const panelId = `job-${job.pickup_id}-panel`;
          const err = formError[job.pickup_id];
          const hazards = job.toxicity_hazards ?? [];
          const km = formatKm(job.distance_m);

          return (
            <li
              key={job.pickup_id}
              className="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800/50"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : job.pickup_id)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 p-3.5 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">
                  {job.material_name}
                </span>
                {statusChip(job, isSeller)}
                <span className="ml-auto hidden shrink-0 items-center gap-1.5 sm:flex">
                  {job.estimated_value_naira != null && (
                    <Badge tone="gold">{formatNairaEstimate(job.estimated_value_naira)}</Badge>
                  )}
                  {(job.handover_weight_kg ?? job.estimated_weight_kg) != null && (
                    <Badge tone="outline">
                      {job.handover_weight_kg ?? job.estimated_weight_kg} kg
                    </Badge>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                    open && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>

              {open && (
                <div
                  id={panelId}
                  className="border-t border-slate-200/70 px-3.5 pb-3.5 pt-3 dark:border-slate-700/70"
                >
                  <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    {job.estimated_value_naira != null && (
                      <Fact label="Estimated value" value={formatNairaEstimate(job.estimated_value_naira)} />
                    )}
                    {job.estimated_weight_kg != null && (
                      <Fact label="Estimated weight" value={`${job.estimated_weight_kg} kg`} />
                    )}
                    {job.handover_weight_kg != null && (
                      <Fact label="Weight collected" value={`${job.handover_weight_kg} kg`} />
                    )}
                    {job.accepted_at && <Fact label="Accepted" value={formatDateTime(job.accepted_at)} />}
                    {job.confirm_deadline && (
                      <Fact
                        label="Confirm by"
                        value={formatDateTime(job.confirm_deadline)}
                        tone={job.awaiting_confirmation ? "warn" : undefined}
                      />
                    )}
                    {job.address_text && (
                      <Fact
                        label="Address"
                        value={
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {job.address_text}
                            {isApproxLocation(job.location_precision) && (
                              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                approx.
                              </span>
                            )}
                          </span>
                        }
                      />
                    )}
                    {!isSeller && km && <Fact label="Distance" value={km} />}
                    {hazards.length > 0 && (
                      <Fact
                        label="Hazards"
                        value={
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                            {hazards.join(", ")}
                          </span>
                        }
                      />
                    )}
                    {!isSeller && job.contact_phone && (
                      <Fact
                        label="Seller contact"
                        value={
                          <a
                            href={`tel:${job.contact_phone}`}
                            className="underline decoration-slate-300 underline-offset-2 hover:decoration-brand-500 dark:decoration-slate-600"
                          >
                            {formatPhoneDisplay(job.contact_phone) ?? job.contact_phone}
                          </a>
                        }
                      />
                    )}
                  </dl>

                  {isSeller && job.status === "disputed" && (
                    <p className="mt-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Support is reviewing this handover. No action needed.
                    </p>
                  )}

                  {isSeller && (
                    <SellerCode
                      job={job}
                      copied={copiedId === job.pickup_id}
                      onCopy={() => onCopy(job)}
                    />
                  )}

                  {!isSeller && (
                    <div className="mt-4">
                      {job.status === "disputed" ? (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Support is reviewing this handover. No action needed.
                        </p>
                      ) : RECORDABLE.has(job.status) ? (
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            onRecordWeight(job);
                          }}
                        >
                          <label
                            htmlFor={`${job.pickup_id}-weight`}
                            className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Weight collected (kg)
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                              <input
                                id={`${job.pickup_id}-weight`}
                                type="number"
                                inputMode="decimal"
                                min="0.1"
                                step="0.1"
                                placeholder="e.g. 22"
                                value={weights[job.pickup_id] ?? ""}
                                onChange={(e) =>
                                  setWeights((prev) => ({ ...prev, [job.pickup_id]: e.target.value }))
                                }
                                aria-describedby={err ? `${job.pickup_id}-weight-err` : undefined}
                                aria-invalid={Boolean(err)}
                                className="input h-12 pr-10"
                              />
                              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-semibold text-slate-400">
                                kg
                              </span>
                            </div>
                            <Button type="submit" className="h-12" loading={busy}>
                              Record weight
                            </Button>
                          </div>
                          {err && (
                            <p
                              id={`${job.pickup_id}-weight-err`}
                              role="alert"
                              className="text-xs font-semibold text-red-600 dark:text-red-400"
                            >
                              {err}
                            </p>
                          )}
                        </form>
                      ) : job.awaiting_confirmation ? (
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            onConfirmCode(job);
                          }}
                        >
                          <label
                            htmlFor={`${job.pickup_id}-pin`}
                            className="block text-xs font-semibold text-slate-500 dark:text-slate-400"
                          >
                            Code from the seller
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              id={`${job.pickup_id}-pin`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              maxLength={6}
                              placeholder="000000"
                              value={pins[job.pickup_id] ?? ""}
                              onChange={(e) =>
                                setPins((prev) => ({
                                  ...prev,
                                  [job.pickup_id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                                }))
                              }
                              aria-describedby={err ? `${job.pickup_id}-pin-err` : undefined}
                              aria-invalid={Boolean(err)}
                              className="input h-12 flex-1 text-center font-mono text-lg tracking-[0.3em]"
                            />
                            <Button
                              type="submit"
                              className="h-12"
                              loading={busy}
                              disabled={!/^\d{6}$/.test(pins[job.pickup_id] ?? "")}
                            >
                              Confirm handover
                            </Button>
                          </div>
                          {err && (
                            <p
                              id={`${job.pickup_id}-pin-err`}
                              role="alert"
                              className="text-xs font-semibold text-red-600 dark:text-red-400"
                            >
                              {err}
                            </p>
                          )}
                        </form>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold",
          tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-100",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SellerCode({
  job,
  copied,
  onCopy,
}: {
  job: PickupJob;
  copied: boolean;
  onCopy: () => void;
}) {
  if (!job.handover_pin || job.status === "disputed") {
    return null;
  }

  return (
    <div className="relative mt-4 flex flex-col gap-3 rounded-xl bg-brand-700 p-4 sm:flex-row sm:items-center sm:justify-between">
      <span aria-live="polite" className="sr-only">
        {copied ? "Code copied" : ""}
      </span>
      {copied && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
          <Check className="h-3 w-3" aria-hidden="true" /> Copied
        </span>
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy confirmation code ${job.handover_pin}`}
        className="group -mx-1 flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-left"
      >
        <span className="font-mono text-2xl font-bold tracking-[0.28em] tabular-nums text-white">
          {job.handover_pin}
        </span>
        {!copied && (
          <Copy
            className="h-4 w-4 shrink-0 text-white/60 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        )}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        {job.collector_phone && (
          <a className="btn-white h-11 w-full px-4 text-sm sm:w-auto" href={`tel:${job.collector_phone}`}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call {formatPhoneDisplay(job.collector_phone) ?? job.collector_phone}
          </a>
        )}
      </div>
    </div>
  );
}

export default JobsListCard;
