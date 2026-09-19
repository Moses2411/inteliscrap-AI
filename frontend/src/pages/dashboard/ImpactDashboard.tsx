import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Coins,
  Leaf,
  RefreshCw,
  Scale,
  ShieldCheck,
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
import { formatCompactNaira, formatKg } from "../../utils/formatters";
import { getRole } from "../../services/auth";

type Metric = "tonnage" | "carbon" | "income";

export default function ImpactDashboard() {
  const impact = useImpactData();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>("tonnage");
  const role = getRole();
  const isAdmin = role === "admin";

  const s = impact.data?.summary;
  const daily = impact.data?.daily ?? [];
  const byMaterial = impact.data?.byMaterial ?? [];

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
    color: ["#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#f43f5e", "#14b8a6"][i % 6],
  }));

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

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total tonnage"
          value={impact.loading || !s ? "—" : formatKg(s.total_tonnage_kg)}
          icon={<Scale className="h-5 w-5" />}
          hint="since inception"
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
          hint="paid to informal recyclers"
        />
        <StatCard
          label="Settled transactions"
          value={impact.loading || !s ? "—" : s.transactions_count.toLocaleString()}
          icon={<Coins className="h-5 w-5" />}
          iconClass="bg-violet-50 text-violet-600 dark:bg-violet-950/80 dark:text-violet-300"
          hint="verified pickups"
        />
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
              <p>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Copper</span> recycling avoids the
                highest CO₂e per kg.
              </p>
              <p>
                <span className="font-bold text-slate-700 dark:text-slate-200">E-waste</span> diversion keeps toxic
                boards out of landfills and water sources.
              </p>
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