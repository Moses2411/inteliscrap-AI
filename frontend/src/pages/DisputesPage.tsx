import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Ban, CheckCircle2, Phone, Scale } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { getToken } from "../services/auth";
import {
  fetchDisputes,
  resolveDispute,
  type DisputeItem,
} from "../services/pickups";
import { formatDateTime } from "../utils/formatters";

export default function DisputesPage() {
  const [items, setItems] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await fetchDisputes());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refresh();
  }, [refresh]);

  async function onResolve(item: DisputeItem, resolution: "confirm" | "cancel") {
    setBusyId(item.pickup_id);
    setError(null);
    try {
      await resolveDispute(item.pickup_id, resolution);
      setResolved(
        `${item.material_name}: ${resolution === "confirm" ? "confirmed" : "cancelled"}.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve dispute");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <PageHeader
        title="Handover disputes"
        subtitle="Unconfirmed handovers that passed their window — release the hold"
        actions={
          <Badge tone="amber">
            <Scale className="h-3 w-3" /> {items.length}
          </Badge>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900">
          {error}
        </div>
      )}
      {resolved && (
        <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900">
          {resolved}
        </div>
      )}

      {loading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="No open disputes"
          subtitle="Every handover has been confirmed or resolved. Nice and clean."
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.pickup_id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-bold text-slate-900 dark:text-white">
                  {item.material_name}
                  {item.handover_weight_kg != null && (
                    <span className="ml-1.5 text-xs font-medium text-slate-400">
                      {item.handover_weight_kg} kg collected
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.address_text ?? "Location on request"}
                </p>
              </div>
              <Badge tone="amber">
                <AlertTriangle className="h-3 w-3" /> Disputed
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {item.accepted_at && (
                <Badge tone="slate">Accepted {formatDateTime(item.accepted_at)}</Badge>
              )}
              {item.confirm_deadline && (
                <Badge tone="sky">Due {formatDateTime(item.confirm_deadline)}</Badge>
              )}
            </div>

            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Seller: {item.seller_phone ?? item.seller_id}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Collector:{" "}
                {item.collector_phone ?? item.collector_id ?? "unassigned"}
              </p>
              {item.dispute_reason && (
                <p className="text-slate-400">Reason: {item.dispute_reason}</p>
              )}
            </div>

            <div className="mt-auto flex gap-2">
              <Button
                size="sm"
                fullWidth
                onClick={() => onResolve(item, "confirm")}
                loading={busyId === item.pickup_id}
                disabled={busyId != null || item.handover_weight_kg == null}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Force-confirm
              </Button>
              <Button
                size="sm"
                variant="secondary"
                fullWidth
                onClick={() => onResolve(item, "cancel")}
                disabled={busyId != null}
              >
                <Ban className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
