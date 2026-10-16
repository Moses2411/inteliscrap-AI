import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { getToken } from "../../services/auth";
import {
  confirmHandover,
  fetchAwaitingConfirmation,
  type PickupJob,
} from "../../services/pickups";
import { formatDateTime } from "../../utils/formatters";

function statusBadge(job: PickupJob) {
  if (job.status === "disputed") {
    return (
      <Badge tone="amber">
        <AlertTriangle className="h-3 w-3" /> Under review
      </Badge>
    );
  }
  if (job.awaiting_confirmation) {
    return (
      <Badge tone="brand">
        <Clock className="h-3 w-3" /> Enter PIN
      </Badge>
    );
  }
  return <Badge tone="slate">Collector on the way</Badge>;
}

export function HandoverConfirmCard({ className }: { className?: string }) {
  const [jobs, setJobs] = useState<PickupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [pins, setPins] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setJobs(await fetchAwaitingConfirmation());
    } catch {
      // Non-fatal: the card simply stays empty.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refresh();
  }, [refresh]);

  async function onConfirm(job: PickupJob) {
    const pin = (pins[job.pickup_id] ?? "").trim();
    if (pin.length < 4) {
      setError("Enter the 6-digit code the collector read out.");
      return;
    }
    setBusyId(job.pickup_id);
    setError(null);
    try {
      const txn = await confirmHandover(job.pickup_id, pin);
      setDone(
        `Confirmed ${job.material_name}${txn.weight_kg ? ` · ${txn.weight_kg} kg` : ""}. Thank you — verified.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-3 w-full" />
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className={className}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Handover confirmations</h3>
        </div>
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" strokeWidth={1.5} />}
          title="Nothing to confirm"
          subtitle="When a collector collects your scrap, enter the code they give you here to confirm it."
          className="py-6"
        />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Handover confirmations</h3>
        <Badge tone="brand" className="ml-auto">
          {jobs.length} open
        </Badge>
      </div>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        New listings are paused until every handover below is confirmed with the
        collector's code.
      </p>

      {done && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900">
          <CheckCircle2 className="h-4 w-4" /> {done}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {jobs.map((job) => (
          <li
            key={job.pickup_id}
            className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {job.material_name}
                {job.handover_weight_kg != null && (
                  <span className="ml-1.5 text-xs font-medium text-slate-400">
                    {job.handover_weight_kg} kg
                  </span>
                )}
              </p>
              {statusBadge(job)}
            </div>
            {job.confirm_deadline && job.awaiting_confirmation && (
              <p className="mt-1 text-[11px] text-slate-400">
                Confirm by {formatDateTime(job.confirm_deadline)}
              </p>
            )}

            {job.awaiting_confirmation ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  aria-label={`Confirmation code for ${job.material_name}`}
                  className="input flex-1 rounded-full border-transparent bg-slate-100 px-4 py-2.5 text-center text-lg font-bold tracking-widest dark:border-transparent dark:bg-slate-800"
                  value={pins[job.pickup_id] ?? ""}
                  onChange={(e) =>
                    setPins((prev) => ({
                      ...prev,
                      [job.pickup_id]: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
                <Button
                  onClick={() => onConfirm(job)}
                  loading={busyId === job.pickup_id}
                  disabled={busyId != null || (pins[job.pickup_id] ?? "").length !== 6}
                >
                  Confirm
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {job.status === "disputed"
                  ? "This handover is being reviewed by support."
                  : "Waiting for the collector to record the collection."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default HandoverConfirmCard;
