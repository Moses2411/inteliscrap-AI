import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  MapPin,
  Navigation,
  Phone,
  ShieldAlert,
  Truck,
  Weight,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/ui/StatusBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useTranslation } from "../hooks/useTranslation";
import { getToken } from "../services/auth";
import { fetchActivePickups, type PickupJob } from "../services/pickups";
import { formatDateTime, formatNaira } from "../utils/formatters";

export default function MyPickupsPage() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<PickupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          totalValue ? ` · ${formatNaira(totalValue)} locked in` : ""
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
                {job.estimated_value_naira != null && (
                  <Badge tone="gold">{formatNaira(job.estimated_value_naira)}</Badge>
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