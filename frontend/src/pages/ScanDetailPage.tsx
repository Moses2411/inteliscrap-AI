import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Coins,
  Phone,
  Scale,
  Search,
  Store,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../components/ui/PageMotion";
import { getScanById, markScanListed, softDeleteScan } from "../services/db";
import { fetchMaterials } from "../services/materials";
import { createListing, checkListingAllowed, fetchMyListings } from "../services/listings";
import { getSavedPhone } from "../services/auth";
import {
  formatConfidence,
  formatDateTime,
  formatKg,
  formatNairaEstimate,
} from "../utils/formatters";
import type { ScrapScan, MaterialCategoryInfo } from "../types";
import { cn } from "../lib/cn";

const HAZARD_TONE: Record<string, string> = {
  corrosive_acid: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  chemical_burns: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  lead_poisoning: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  pcb_contamination: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  lithium_fire_risk: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  mercury_exposure: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  asbestos_fibers: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  sharp_edges: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const HAZARD_LABEL: Record<string, string> = {
  corrosive_acid: "Corrosive acid",
  chemical_burns: "Chemical burns",
  lead_poisoning: "Lead poisoning",
  pcb_contamination: "PCB contamination",
  lithium_fire_risk: "Lithium fire risk",
  mercury_exposure: "Mercury exposure",
  asbestos_fibers: "Asbestos fibers",
  sharp_edges: "Sharp edges",
};

function hazardLabel(key: string): string {
  return HAZARD_LABEL[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [scan, setScan] = useState<ScrapScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<MaterialCategoryInfo | null>(null);
  const [listing, setListing] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [listingError, setListingError] = useState<string | null>(null);
  const [sharePhone, setSharePhone] = useState(false);
  const [listedStatus, setListedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const found = await getScanById(id);
      if (cancelled) return;
      setScan(found ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Already-listed detection: trust the local link first (scan.listing_id, saved
  // after we create a listing), then refresh its live status from the server so
  // completed jobs stay marked as listed instead of reverting to "not listed".
  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    (async () => {
      if (scan.listing_id) {
        setListedStatus(scan.listing_status ?? "active");
      }
      try {
        const mine = await fetchMyListings();
        if (cancelled) return;
        const expectedTitles = [
          scan.sub_grade ? `${scan.material_class} — ${scan.sub_grade}` : scan.material_class,
          scan.material_class,
        ];
        const match = scan.listing_id
          ? mine.find((l) => l.id === scan.listing_id)
          : mine.find(
              (l) => l.title && expectedTitles.includes(l.title) && l.status !== "cancelled",
            );
        if (match && match.status !== "cancelled") {
          setListedStatus(match.status);
          if (scan.listing_id !== match.id || scan.listing_status !== match.status) {
            await markScanListed(scan.id, match.id, match.status);
          }
        }
      } catch {
        // offline or listings unavailable — keep the locally cached link
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scan]);

  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    (async () => {
      try {
        const materials = await fetchMaterials();
        if (cancelled) return;
        const match = materials.find(
          (m) =>
            m.name.toLowerCase() === scan.material_class.toLowerCase() ||
            m.slug.toLowerCase() === scan.material_class.toLowerCase().replace(/\s+/g, "-"),
        );
        setCategory(match ?? null);
      } catch {
        // materials unavailable offline — listing will show a helpful error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scan]);

  const hasHazards = (scan?.toxicity_hazards?.length ?? 0) > 0;
  const alreadyListed = listedStatus != null || listing === "success";

  const handleList = useCallback(async () => {
    if (!scan) return;
    setListing("loading");
    setListingError(null);

    try {
      const eligibility = await checkListingAllowed();
      if (!eligibility.allowed) {
        setListing("error");
        setListingError(eligibility.error || "Listing limit reached. Upgrade your plan to continue.");
        return;
      }

      if (!category) {
        setListing("error");
        setListingError(
          `Could not match "${scan.material_class}" to a market category. Try scanning again.`,
        );
        return;
      }

      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        // geo is optional
      }

      const phone = getSavedPhone();
      const created = await createListing({
        material_category_id: category.id,
        title: scan.sub_grade ? `${scan.material_class} — ${scan.sub_grade}` : scan.material_class,
        estimated_value_naira: scan.estimated_naira_value,
        confidence_score: scan.confidence_score,
        toxicity_hazards: scan.toxicity_hazards,
        latitude,
        longitude,
        contact_phone: sharePhone && phone ? phone : undefined,
        auto_dispatch: latitude != null,
      });

      await markScanListed(scan.id, created.id, created.status);
      setListedStatus(created.status ?? "active");
      setListing("success");
    } catch (err) {
      setListing("error");
      setListingError(err instanceof Error ? err.message : "Listing failed. Try again.");
    }
  }, [scan, category, sharePhone]);

  const handleDelete = useCallback(async () => {
    if (!scan) return;
    await softDeleteScan(scan.id);
    navigate("/history");
  }, [scan, navigate]);

  const stats = useMemo(() => {
    if (!scan) return [];
    const items = [
      {
        label: "Estimated value",
        value: formatNairaEstimate(scan.estimated_naira_value),
        icon: <Coins className="h-5 w-5" />,
        iconClass: "bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300",
      },
      {
        label: "Confidence",
        value: formatConfidence(scan.confidence_score),
        icon: <TrendingUp className="h-5 w-5" />,
        iconClass: "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
      },
    ];
    if (scan.weight_est_kg != null) {
      items.push({
        label: "Weight",
        value: formatKg(scan.weight_est_kg),
        icon: <Scale className="h-5 w-5" />,
        iconClass: "bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300",
      });
    }
    items.push({
      label: "Scanned",
      value: formatDateTime(scan.captured_at),
      icon: <Calendar className="h-5 w-5" />,
      iconClass: "bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300",
    });
    return items;
  }, [scan]);

  if (loading) {
    return (
      <PageMotion className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-32 w-full" />
      </PageMotion>
    );
  }

  if (!scan) {
    return (
      <PageMotion>
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="Scan not found"
          subtitle="This scan may have been deleted or is no longer on this device."
          action={
            <Button variant="secondary" onClick={() => navigate("/history")}>
              <ArrowLeft className="h-4 w-4" /> Back to history
            </Button>
          }
        />
      </PageMotion>
    );
  }

  return (
    <PageMotion className="space-y-6">
      {/* Back + title */}
      <motion.div variants={pageItem} className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all duration-150 hover:border-slate-300 hover:text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {scan.material_class}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {scan.sub_grade ? `${scan.sub_grade} · ` : ""}
            {formatDateTime(scan.captured_at)}
          </p>
        </div>
        <div className="ml-auto">
          <Badge tone={scan.is_synced ? "green" : "amber"}>
            {scan.is_synced ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <Clock3 className="mr-1 h-3 w-3" />
            )}
            {scan.is_synced ? "Synced" : "Pending sync"}
          </Badge>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                s.iconClass,
              )}
            >
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {s.label}
              </p>
              <p className="truncate text-lg font-extrabold text-slate-900 dark:text-white">
                {s.value}
              </p>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Hazards + safety */}
      {hasHazards && (
        <motion.div variants={pageItem}>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Safety hazards detected
              </h2>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {scan.toxicity_hazards!.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold",
                    HAZARD_TONE[h] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {hazardLabel(h)}
                </span>
              ))}
            </div>
            {scan.safety_instructions && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {scan.safety_instructions}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Listing CTA */}
      <motion.div variants={pageItem}>
        <Card>
          {alreadyListed ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/60">
                <CheckCircle2 className="h-7 w-7 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Already listed
              </h3>
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                {listedStatus === "completed"
                  ? "This sale is complete — the scan stays marked as listed in your history."
                  : `This scrap is ${
                      listedStatus === "matched" || listedStatus === "scheduled"
                        ? "with a collector"
                        : "listed"
                    } — nearby collectors can see it. A collector weighs and confirms the final price at pickup.`}
              </p>
              <Button variant="secondary" onClick={() => navigate("/market")}>
                <Store className="h-4 w-4" /> View market
              </Button>
            </div>
          ) : listing === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/60">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Could not create listing
              </h3>
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{listingError}</p>
              <Button variant="secondary" onClick={() => setListing("idle")}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  List this scrap on the market
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Nearby collectors will be notified. A collector weighs and confirms the final
                  price at pickup.
                </p>
              </div>

              {category && (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <Store className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {category.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Market rate: ≈₦{category.price_per_kg_naira}/kg
                    </p>
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600">
                <input
                  type="checkbox"
                  checked={sharePhone}
                  onChange={(e) => setSharePhone(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20"
                />
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Share my phone so collectors can call me
                </span>
              </label>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleList}
                loading={listing === "loading"}
              >
                <Store className="h-4 w-4" />
                List on market — {formatNairaEstimate(scan.estimated_naira_value)}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Delete */}
      {!scan.is_deleted && (
        <motion.div variants={pageItem} className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete scan
          </Button>
        </motion.div>
      )}
    </PageMotion>
  );
}
