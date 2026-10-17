import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Coins,
  Crown,
  Leaf,
  PackageCheck,
  RefreshCw,
  Scale,
  ShieldCheck,
  Truck,
  UsersRound,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { AreaChart } from "../../components/charts/AreaChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { BarList } from "../../components/charts/BarList";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useImpactData } from "../../hooks/useDashboardData";
import { MomoCheckout } from "../../components/payments/MomoCheckout";
import { premiumPlanForRole } from "../../services/subscription";
import { formatCompactNaira, formatKg } from "../../utils/formatters";
import { getRole } from "../../services/auth";

type Metric = "tonnage" | "carbon" | "income";

export default function ImpactDashboard() {
  const impact = useImpactData();
  const navigate = useNavigate();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [metric, setMetric] = useState<Metric>("tonnage");
  const role = getRole();
  const isAdmin = role === "admin";

  const s = impact.data?.summary;
  const daily = impact.data?.daily ?? [];
  const byMaterial = impact.data?.byMaterial ?? [];
  const ops = impact.data?.ops;
  // Standouts in the settled-material breakdown, surfaced in the footnote.
  const topByTonnage = byMaterial[0];
  const topByCarbon = byMaterial.length
    ? byMaterial.reduce((best, m) => (m.carbon_offset_kg_co2e > best.carbon_offset_kg_co2e ? m : best))
    : null;

  const metrics: Record<Metric, { label: string; values: number[]; color: string; format: (v: number) => string }> = {
    tonnage: {
      label: "Tonnage collected (kg)",
      values: daily.map((d) => d.tonnage_kg),
      color: "var(--c-brand)",
      format: (v) => formatKg(v),
    },
    carbon: {
      label: "Carbon offset (kgCO₂e)",
      values: daily.map((d) => d.carbon_offset_kg_co2e),
      color: "var(--c-gold)",
      format: (v) => `${Math.round(v).toLocaleString()} kg`,
    },
    income: {
      label: "Collector income (₦)",
      values: daily.map((d) => d.collector_income_naira),
      color: "var(--c-sky)",
      format: (v) => `₦${Math.round(v).toLocaleString()}`,
    },
  };
  const activeMetric = metrics[metric];

  const donutSegments = byMaterial.map((m, i) => ({
    label: m.material,
    value: m.tonnage_kg,
    // Enough distinct hues to cover every seeded material without repeats.
    color: [
      "#10b981",
      "#f59e0b",
      "#0ea5e9",
      "#8b5cf6",
      "#f43f5e",
      "#14b8a6",
      "#6366f1",
      "#84cc16",
    ][i % 8],
  }));

  const planInfo = premiumPlanForRole(role);
  const premiumBlocked = !impact.loading && !impact.data && !!impact.error;

  if (premiumBlocked) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title="Circular economy impact"
          subtitle="Network-wide tonnage, carbon and income analytics."
        />
        <Card pad>
          <div className="mx-auto max-w-md py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
              {planInfo ? `${planInfo.name} unlocks this data` : "Premium access required"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {planInfo
                ? `Subscribe to ${planInfo.name} to view the full network impact data.`
                : "An active premium subscription is required to access this data."}
            </p>
            {planInfo && (
              <Button className="mt-4" variant="gold" onClick={() => setCheckoutOpen(true)}>
                <Crown className="h-4 w-4" /> Subscribe to {planInfo.name}
              </Button>
            )}
          </div>
        </Card>
        {planInfo && (
          <MomoCheckout
            open={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            purpose="user_subscription"
            plan={planInfo.plan}
            planLabel={planInfo.name}
            amountNaira={planInfo.priceNaira}
            title={`Subscribe to ${planInfo.name}`}
            description={`${planInfo.blurb} Pay in seconds with MTN MoMo.`}
            onSuccess={() => {
              setCheckoutOpen(false);
              impact.refresh();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Circular economy impact"
        subtitle="Verified tonnage, carbon offsets and collector income across the network."
        actions={
          <div className="flex items-center gap-2">
            {impact.isPreview && <PreviewPill />}
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => navigate("/compliance")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Compliance
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={impact.refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Honest provenance: say whether these numbers are live settlements or seed/demo */}
      {!impact.loading && s && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {s.computed_from === "settlements" ? (
            <Badge tone="green">Live settlement ledger</Badge>
          ) : impact.isPreview || s.computed_from === "demo" ? (
            <Badge tone="amber">Preview / demo data</Badge>
          ) : (
            <Badge tone="slate">Seeded impact logs</Badge>
          )}
          <span>
            {s.computed_from === "settlements"
              ? "Computed directly from settled transactions."
              : "Aggregated from recorded impact logs — not live settlement data."}
          </span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total tonnage"
          value={impact.loading || !s ? "—" : formatKg(s.total_tonnage_kg)}
          icon={<Scale className="h-5 w-5" />}
          hint="Since inception"
        />
        <StatCard
          label="Carbon offset"
          value={impact.loading || !s ? "—" : `${Math.round(s.total_carbon_offset_kg_co2e).toLocaleString()} kgCO₂e`}
          icon={<Leaf className="h-5 w-5" />}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300"
          hint="CO₂e avoided via recycling"
        />
        <StatCard
          label="Collector income"
          value={impact.loading || !s ? "—" : formatCompactNaira(s.total_collector_income_naira)}
          icon={<Banknote className="h-5 w-5" />}
          iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
          hint="Paid to informal recyclers"
        />
        <StatCard
          label="Settled transactions"
          value={impact.loading || !s ? "—" : s.transactions_count.toLocaleString()}
          icon={<Coins className="h-5 w-5" />}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300"
          hint="Verified pickups"
        />
      </div>

      {/* Network operations — the collector's Active jobs / Available offers /
          Jobs value cards, aggregated across every collector for oversight. */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Network operations</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Truck className="h-3.5 w-3.5" /> all collectors
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="Active jobs"
            value={impact.loading || !ops ? "—" : ops.active_jobs.toLocaleString()}
            icon={<Truck className="h-5 w-5" />}
            iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
            hint="Pickups in progress"
          />
          <StatCard
            label="Available offers"
            value={impact.loading || !ops ? "—" : ops.available_offers.toLocaleString()}
            icon={<PackageCheck className="h-5 w-5" />}
            iconClass="bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-300"
            hint="Open offers awaiting a collector"
          />
          <StatCard
            label="Jobs value"
            value={impact.loading || !ops ? "—" : formatCompactNaira(ops.jobs_value_naira)}
            icon={<Banknote className="h-5 w-5" />}
            iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
            hint="Estimated value of active jobs"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main chart */}
        <Card pad className="lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Network activity</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last 14 days · per day</p>
            </div>
            <SegmentedTabs<Metric>
              value={metric}
              onChange={setMetric}
              options={[
                { value: "tonnage", label: "Tonnage" },
                { value: "carbon", label: "CO₂e" },
                { value: "income", label: "Income" },
              ]}
            />
          </div>

          {impact.loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : daily.length === 0 ? (
            <EmptyState
              icon={<Leaf className="h-6 w-6" />}
              title="No activity recorded yet"
              subtitle="Settled pickups will appear here as daily aggregates."
            />
          ) : (
            <AreaChart
              labels={daily.map((d) => d.period)}
              series={[{ name: activeMetric.label, values: activeMetric.values, color: activeMetric.color }]}
              height={240}
              formatValue={activeMetric.format}
            />
          )}
        </Card>

        {/* By material */}
        <Card pad className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">By material</h2>
            <Badge tone="green">
              <Leaf className="h-3 w-3" /> {byMaterial.length} classes
            </Badge>
          </div>
          {impact.loading ? (
            <div className="space-y-3">
              <Skeleton className="mx-auto h-40 w-40 rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : byMaterial.length === 0 ? (
            <EmptyState icon={<Scale className="h-6 w-6" />} title="No breakdown yet" />
          ) : (
            <DonutChart
              segments={donutSegments}
              centerValue={`${byMaterial.reduce((a, b) => a + b.tonnage_kg, 0).toLocaleString()} kg`}
              centerLabel="total kg"
              formatValue={(v) => formatKg(v)}
            />
          )}
        </Card>
      </div>

      <Card pad>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Carbon offset by material</h2>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <UsersRound className="h-3.5 w-3.5" /> network wide
          </span>
        </div>
        {impact.loading ? (
          <Skeleton className="h-40 w-full" />
        ) : byMaterial.length === 0 ? (
          <EmptyState icon={<Leaf className="h-6 w-6" />} title="No carbon data yet" />
        ) : (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            <BarList
              items={byMaterial.map((m) => ({
                label: m.material,
                value: m.carbon_offset_kg_co2e,
                valueLabel: `${Math.round(m.carbon_offset_kg_co2e).toLocaleString()} kg`,
              }))}
            />
            <div className="hidden flex-col justify-center gap-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 md:flex">
              {topByTonnage && (
                <p>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{topByTonnage.material}</span> leads
                  recovered tonnage at {formatKg(topByTonnage.tonnage_kg)}.
                </p>
              )}
              {topByCarbon && (
                <p>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{topByCarbon.material}</span> offsets
                  the most CO₂e at {Math.round(topByCarbon.carbon_offset_kg_co2e).toLocaleString()} kg.
                </p>
              )}
              <Button variant="ghost" size="sm" className="!justify-start !px-0" onClick={() => navigate("/market")}>
                Explore the market <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}