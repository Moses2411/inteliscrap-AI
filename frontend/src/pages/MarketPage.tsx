import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  Factory,
  MapPin,
  Phone,
  Recycle,
  ShieldAlert,
  Store,
  Tag,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { PreviewPill } from "../components/ui/PreviewPill";
import { Button } from "../components/ui/Button";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SearchInput } from "../components/ui/SearchInput";
import { StatusBadge, StatusDot } from "../components/ui/StatusBadge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageMotion, pageItem } from "../components/ui/PageMotion";
import { useMarketData } from "../hooks/useDashboardData";
import { materialNameById } from "../services/market";
import { acceptListing } from "../services/listings";
import { getRole } from "../services/auth";
import { formatDateTime, formatNairaEstimate, relativeTime } from "../utils/formatters";
import { cn } from "../lib/cn";

type Tab = "listings" | "requests" | "prices" | "hubs";

export default function MarketPage() {
  const market = useMarketData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Who sees what: collectors see the listing board (they accept the offers),
  // households (sellers) see only their own listings, and both see the demand
  // hubs are posting. Everyone sees the price guide and the hub directory.
  const role = getRole();
  const canSeeListings = role === "collector";
  const canSeeHubRequests = role === "collector" || role === "seller";

  const allowedTabs = useMemo<Tab[]>(
    () => [
      ...(canSeeListings ? (["listings"] as Tab[]) : []),
      ...(canSeeHubRequests ? (["requests"] as Tab[]) : []),
      "prices",
      "hubs",
    ],
    [canSeeListings, canSeeHubRequests],
  );
  const defaultTab: Tab = canSeeListings ? "listings" : canSeeHubRequests ? "requests" : "prices";

  const [tab, setTabState] = useState<Tab>(() => {
    const requested = searchParams.get("tab") as Tab | null;
    return requested && allowedTabs.includes(requested) ? requested : defaultTab;
  });
  const [q, setQ] = useState("");
  const [hazardOnly, setHazardOnly] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [acceptError, setAcceptError] = useState<{ id: string; message: string } | null>(null);

  const activeTab: Tab = allowedTabs.includes(tab) ? tab : defaultTab;

  const setTab = (next: Tab) => {
    setTabState(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  async function onAcceptOffer(listingId: string) {
    setAcceptingId(listingId);
    setAcceptError(null);
    try {
      await acceptListing(listingId);
      setAcceptedIds((prev) => new Set(prev).add(listingId));
    } catch (err) {
      setAcceptError({
        id: listingId,
        message: err instanceof Error ? err.message : "Could not accept this offer",
      });
    } finally {
      setAcceptingId(null);
    }
  }

  const materials = market.data?.materials ?? [];
  const listings = market.data?.listings ?? [];
  const hubs = market.data?.hubs ?? [];
  const hubRequests = market.data?.hubRequests ?? [];

  const query = q.trim().toLowerCase();

  const filteredListings = useMemo(
    () =>
      listings
        .filter((l) => {
          const name = materialNameById(materials, l.material_category_id) ?? l.title ?? "";
          if (query && !name.toLowerCase().includes(query) && !(l.address_text ?? "").toLowerCase().includes(query)) {
            return false;
          }
          return l.status === "active" || l.status === "matched" || l.status === "scheduled";
        })
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [listings, materials, query],
  );

  const filteredPrices = useMemo(
    () =>
      materials.filter((m) => {
        if (hazardOnly && !m.is_hazardous) return false;
        if (query && !m.name.toLowerCase().includes(query)) return false;
        return true;
      }),
    [materials, query, hazardOnly],
  );

  const filteredHubs = useMemo(
    () =>
      hubs.filter((h) => {
        if (!query) return true;
        return h.name.toLowerCase().includes(query) || h.city.toLowerCase().includes(query);
      }),
    [hubs, query],
  );

  const filteredRequests = useMemo(
    () =>
      hubRequests.filter((r) => {
        if (!query) return true;
        return (
          r.material_name.toLowerCase().includes(query) ||
          r.hub_name.toLowerCase().includes(query)
        );
      }),
    [hubRequests, query],
  );

  const maxVisiblePrice = useMemo(
    () => (filteredPrices.length ? Math.max(...filteredPrices.map((m) => m.price_per_kg_naira)) : 1),
    [filteredPrices],
  );

  return (
    <PageMotion className="space-y-6">
      <motion.div variants={pageItem}>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Store className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              Scrap marketplace
            </span>
          }
          subtitle="Live prices, active sellers and recycling hubs across Zaria."
          actions={
            <div className="flex items-center gap-2">
              {market.isPreview && <PreviewPill />}
              <Button size="sm" onClick={() => navigate("/scan")}>
                <Camera className="h-3.5 w-3.5" /> Sell scrap
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Search + tabs */}
      <motion.div variants={pageItem} className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search materials, hubs or requests…" className="max-w-md" />
        <SegmentedTabs<Tab>
          value={activeTab}
          onChange={setTab}
          options={[
            ...(canSeeListings
              ? [{ value: "listings" as const, label: "Listings", count: filteredListings.length }]
              : []),
            ...(canSeeHubRequests
              ? [{ value: "requests" as const, label: "Hub buy requests", count: filteredRequests.length }]
              : []),
            { value: "prices" as const, label: "Price guide", count: filteredPrices.length },
            { value: "hubs" as const, label: "Recycling hubs", count: filteredHubs.length },
          ]}
        />
      </motion.div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-6"
      >
      {/* ── Listings (collectors) ────────────────────────────── */}
      {activeTab === "listings" && (
        <>
          {market.loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <EmptyState
              icon={<Tag className="h-6 w-6" />}
              title="No listings match"
              subtitle="Households post scrap here as they scan it. Try a different search — or scan your own lot."
              action={<Button size="sm" onClick={() => navigate("/scan")}>Scan & sell</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredListings.map((l) => {
                const name = materialNameById(materials, l.material_category_id) ?? l.title ?? "Scrap";
                const hazards = Array.isArray(l.toxicity_hazards) ? (l.toxicity_hazards as string[]) : [];
                return (
                  <Card key={l.id} hover className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300">
                          <Recycle className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {l.address_text ?? "Location on request"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {l.estimated_weight_kg != null && (
                        <Badge tone="slate">
                          <Tag className="h-3 w-3" /> {l.estimated_weight_kg} kg
                        </Badge>
                      )}
                      {l.estimated_value_naira != null && (
                        <Badge tone="gold">{formatNairaEstimate(l.estimated_value_naira)}</Badge>
                      )}
                      {hazards.length > 0 && (
                        <Badge tone="red">
                          <ShieldAlert className="h-3 w-3" /> {hazards.length} hazard{hazards.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                        {l.created_at ? formatDateTime(l.created_at) : ""}
                      </span>
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" fullWidth href={l.contact_phone ? `tel:${l.contact_phone}` : undefined}>
                          <Phone className="h-3.5 w-3.5" /> Contact seller
                        </Button>
                        {acceptedIds.has(l.id) ? (
                          <Button variant="soft" size="sm" disabled>
                            <Check className="h-3.5 w-3.5" /> Accepted
                          </Button>
                        ) : (
                          <Button
                            variant="soft"
                            size="sm"
                            onClick={() => onAcceptOffer(l.id)}
                            loading={acceptingId === l.id}
                            disabled={l.status !== "active" && l.status !== "matched"}
                          >
                            {l.status === "active" || l.status === "matched" ? (
                              <>
                                Accept offer <ArrowRight className="h-3.5 w-3.5" />
                              </>
                            ) : (
                              "Unavailable"
                            )}
                          </Button>
                        )}
                      </div>
                      {acceptedIds.has(l.id) && (
                        <button
                          type="button"
                          onClick={() => navigate("/my-pickups")}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Added to My jobs <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                      {acceptError?.id === l.id && (
                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400" role="alert">
                          {acceptError.message}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Hub buy requests (collectors + households) ────────── */}
      {activeTab === "requests" && (
        <>
          {market.loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={<Factory className="h-6 w-6" />}
              title="No hub buy requests right now"
              subtitle="Recycling hubs post what they are buying here. Check back soon, or list your own scrap."
              action={<Button size="sm" onClick={() => navigate("/scan")}>Scan & list</Button>}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRequests.map((r) => {
                const progress =
                  r.requested_kg > 0
                    ? Math.min(100, Math.round((r.fulfilled_kg / r.requested_kg) * 100))
                    : 0;
                return (
                  <Card key={r.id} hover className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Factory className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {r.material_name || "Material"}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {r.hub_name}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="brand">
                        <Tag className="h-3 w-3" /> {r.requested_kg} kg wanted
                      </Badge>
                      <Badge tone="slate">{r.fulfilled_kg} kg fulfilled</Badge>
                      <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                        {relativeTime(r.requested_on)}
                      </span>
                    </div>

                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                      aria-hidden="true"
                    >
                      <motion.div
                        className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(progress, 4)}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      />
                    </div>

                    {r.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{r.note}</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Price guide ───────────────────────────────────────── */}
      {activeTab === "prices" && (
        <Card pad>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Material rate card</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Indicative price per kilogram — cached for offline use. Check the update time before trading.
              </p>
            </div>
            <button
              onClick={() => setHazardOnly((v) => !v)}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors",
                hazardOnly
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900"
                  : "bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
              )}
              aria-pressed={hazardOnly}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {hazardOnly ? "Hazardous only" : "All materials"}
            </button>
          </div>

          {filteredPrices.length === 0 ? (
            <EmptyState icon={<Tag className="h-6 w-6" />} title="No materials match" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPrices.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-2 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                        m.is_hazardous
                          ? "bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-300"
                          : "bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300",
                      )}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{m.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {m.is_hazardous ? "Handle with care" : "Safe to handle"}
                        {m.price_last_updated_at
                          ? ` · updated ${relativeTime(m.price_last_updated_at)}`
                          : ""}
                      </p>
                      <div
                        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                        aria-hidden="true"
                      >
                        <motion.div
                          className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(6, Math.round((m.price_per_kg_naira / maxVisiblePrice) * 100))}%`,
                          }}
                          transition={{ type: "spring", stiffness: 120, damping: 20 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {m.is_stale && (
                      <Badge tone="amber">
                        <Clock className="h-3 w-3" /> rate outdated
                      </Badge>
                    )}
                    {m.is_hazardous && (
                      <Badge tone="red">
                        <ShieldAlert className="h-3 w-3" /> hazardous
                      </Badge>
                    )}
                    <span className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
                      {formatNairaEstimate(m.price_per_kg_naira)}
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">/kg</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── Hubs ──────────────────────────────────────────────── */}
      {activeTab === "hubs" && (
        <>
          {market.loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredHubs.length === 0 ? (
            <EmptyState icon={<Factory className="h-6 w-6" />} title="No hubs match" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredHubs.map((h) => (
                <Card key={h.id} hover>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Factory className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{h.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3" /> {h.city}
                        {h.address_text ? ` · ${h.address_text}` : ""}
                      </p>
                    </div>
                    <StatusDot status={h.is_active ? "active" : "expired"} label={h.is_active ? "active" : "inactive"} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    {h.contact_phone && (
                      <Button variant="secondary" size="sm" fullWidth href={`tel:${h.contact_phone}`}>
                        <Phone className="h-3.5 w-3.5" /> Call hub
                      </Button>
                    )}
                    <Button variant="soft" size="sm" onClick={() => navigate("/settings")}>
                      Subscribe <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      </motion.div>
    </PageMotion>
  );
}