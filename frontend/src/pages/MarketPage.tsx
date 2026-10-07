import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
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
import { formatDateTime, formatNaira } from "../utils/formatters";
import { cn } from "../lib/cn";

type Tab = "listings" | "prices" | "hubs";

export default function MarketPage() {
  const market = useMarketData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTabState] = useState<Tab>(tabParam === "prices" || tabParam === "hubs" ? tabParam : "listings");
  const [q, setQ] = useState("");
  const [hazardOnly, setHazardOnly] = useState(false);

  const setTab = (next: Tab) => {
    setTabState(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const materials = market.data?.materials ?? [];
  const listings = market.data?.listings ?? [];
  const hubs = market.data?.hubs ?? [];

  const query = q.trim().toLowerCase();

  const filteredListings = useMemo(
    () =>
      listings
        .filter((l) => {
          const name = materialNameById(materials, l.material_category_id) ?? l.title ?? "";
          if (query && !name.toLowerCase().includes(query) && !(l.address_text ?? "").toLowerCase().includes(query)) {
            return false;
          }
          return l.status === "open" || l.status === "matched" || l.status === "scheduled";
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
        <SearchInput value={q} onChange={setQ} placeholder="Search materials, sellers or hubs…" className="max-w-md" />
        <SegmentedTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "listings", label: "Listings", count: filteredListings.length },
            { value: "prices", label: "Price guide", count: filteredPrices.length },
            { value: "hubs", label: "Recycling hubs", count: filteredHubs.length },
          ]}
        />
      </motion.div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-6"
      >
      {/* ── Listings ─────────────────────────────────────────── */}
      {tab === "listings" && (
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
              subtitle="Try a different search, or post your own scrap for sale."
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
                        <Badge tone="gold">{formatNaira(l.estimated_value_naira)}</Badge>
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

                    <div className="mt-auto flex gap-2">
                      <Button variant="secondary" size="sm" fullWidth href={l.contact_phone ? `tel:${l.contact_phone}` : undefined}>
                        <Phone className="h-3.5 w-3.5" /> Contact seller
                      </Button>
                      <Button variant="soft" size="sm" onClick={() => navigate("/scan")}>
                        Sell yours <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Price guide ───────────────────────────────────────── */}
      {tab === "prices" && (
        <Card pad>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Material rate card</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fair market price per kilogram — cached for offline use
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
                    {m.is_hazardous && (
                      <Badge tone="red">
                        <ShieldAlert className="h-3 w-3" /> hazardous
                      </Badge>
                    )}
                    <span className="text-sm font-bold tabular-nums text-brand-600 dark:text-brand-400">
                      {formatNaira(m.price_per_kg_naira)}
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
      {tab === "hubs" && (
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