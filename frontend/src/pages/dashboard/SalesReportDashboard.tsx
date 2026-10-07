import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs";
import { Table, type Column } from "../../components/ui/Table";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../../components/ui/PageMotion";
import { GroupedBarChart } from "../../components/charts/GroupedBarChart";
import { RadialChart } from "../../components/charts/RadialChart";
import { BubbleCloud } from "../../components/charts/BubbleCloud";
import { useSalesReportData, type RecentSale } from "../../hooks/useDashboardData";
import { formatNaira, formatCompactNaira, formatKg, formatDate } from "../../utils/formatters";

/** Swappable chart palette — all values are CSS variables (theme-aware, light/dark). */
const PALETTE = ["var(--c-brand)", "var(--c-gold)", "var(--c-sky)", "var(--c-violet)", "var(--c-rose)"];

export default function SalesReportDashboard() {
  const report = useSalesReportData();
  const [range, setRange] = useState<"6" | "3">("6");

  const s = report.data;
  const kpis = s?.kpis;
  const byMaterial = s?.byMaterial ?? [];
  const demand = s?.demand ?? [];
  const recent = s?.recent ?? [];
  const loading = report.loading;

  const monthly = useMemo(() => (s?.monthly ?? []).slice(-Number(range)), [s, range]);

  const radialSegments = useMemo(() => {
    const top = byMaterial.slice(0, 4).map((m, i) => ({
      label: m.name,
      value: m.valueNaira,
      color: PALETTE[i % PALETTE.length],
    }));
    const rest = byMaterial.slice(4);
    if (rest.length > 0) {
      top.push({
        label: `Others (${rest.length})`,
        value: rest.reduce((a, m) => a + m.valueNaira, 0),
        color: PALETTE[4],
      });
    }
    return top;
  }, [byMaterial]);

  const radialTotal = radialSegments.reduce((a, seg) => a + seg.value, 0);

  const demandBubbles = demand.slice(0, 6).map((d, i) => ({
    label: d.name,
    value: d.requestedKg,
    color: PALETTE[i % PALETTE.length],
  }));

  const colorFor = (material: string) => {
    const i = byMaterial.findIndex((m) => m.name === material);
    return i >= 0 ? PALETTE[i % PALETTE.length] : "var(--c-brand)";
  };

  const columns: Column<RecentSale>[] = [
    {
      key: "material",
      label: "Material",
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(r.material) }} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{r.material}</p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{r.id}</p>
          </div>
        </div>
      ),
    },
    { key: "weight", label: "Weight", render: (r) => <span className="tabular-nums">{formatKg(r.weightKg)}</span> },
    {
      key: "unit",
      label: "Unit price",
      align: "right",
      render: (r) => <span className="tabular-nums">{formatNaira(r.unitPriceNaira)}</span>,
    },
    {
      key: "settled",
      label: "Settled",
      align: "right",
      render: (r) => <span className="whitespace-nowrap">{r.settledAt ? formatDate(r.settledAt) : "—"}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (r) => (
        <span className="font-bold tabular-nums text-slate-900 dark:text-white">{formatNaira(r.valueNaira)}</span>
      ),
    },
  ];

  if (report.error && !s) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <EmptyState
          icon={<Banknote className="h-6 w-6" />}
          title="Could not load the sales report"
          subtitle={report.error}
          action={
            <Button variant="secondary" size="sm" onClick={report.refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          }
        />
      </motion.div>
    );
  }

  return (
    <PageMotion className="space-y-6">
        <motion.div variants={pageItem}>
          <PageHeader
            title="Sales report"
            subtitle="Supply, settlements and material revenue across your hub."
            actions={
              <div className="flex items-center gap-2">
                {report.isPreview && <PreviewPill />}
                <Button variant="secondary" size="sm" onClick={report.refresh}>
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            }
          />
        </motion.div>

        {/* KPI row */}
        <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <motion.div variants={pageItem} whileHover={{ scale: 1.02 }} className="min-w-0">
            <Card gradient className="h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Gross sales</p>
                  <p className="mt-1.5 truncate text-2xl font-bold tracking-tight sm:text-[27px]">
                    {loading || !kpis ? "—" : formatNaira(kpis.grossSales)}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <Banknote className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {kpis?.trendPct != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 font-bold">
                    {kpis.trendPct >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(kpis.trendPct).toFixed(1)}%
                  </span>
                )}
                <span className="truncate text-white/70">settled revenue · vs previous month</span>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={pageItem} className="min-w-0">
            <StatCard
              className="h-full"
              label="Kilograms traded"
              value={loading || !kpis ? "—" : formatKg(kpis.kgTraded)}
              icon={<Scale className="h-5 w-5" />}
              hint={`Across ${byMaterial.length} materials`}
            />
          </motion.div>
          <motion.div variants={pageItem} className="min-w-0">
            <StatCard
              className="h-full"
              label="Settled deliveries"
              value={loading || !kpis ? "—" : kpis.deliveries.toLocaleString()}
              icon={<PackageCheck className="h-5 w-5" />}
              iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300"
              hint="Verified transactions"
            />
          </motion.div>
          <motion.div variants={pageItem} className="min-w-0">
            <StatCard
              className="h-full"
              label="Open requests"
              value={loading || !kpis ? "—" : kpis.openRequests.toLocaleString()}
              icon={<ClipboardList className="h-5 w-5" />}
              iconClass="bg-amber-50 text-amber-600 dark:bg-amber-950/80 dark:text-amber-300"
              hint="Awaiting fulfilment"
            />
          </motion.div>
        </motion.div>

        {/* Radial + grouped bars */}
        <motion.div variants={pageItem} className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sales by material</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">share of settled revenue</p>
                </div>
              </div>
              {loading ? (
                <div className="flex flex-col items-center gap-5">
                  <Skeleton className="h-40 w-40 rounded-full" />
                  <div className="w-full space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              ) : radialSegments.length === 0 ? (
                <EmptyState icon={<Scale className="h-6 w-6" />} title="No settled sales yet" />
              ) : (
                <RadialChart
                  segments={radialSegments}
                  centerValue={formatCompactNaira(radialTotal)}
                  centerLabel="settled"
                  formatValue={(v) => formatCompactNaira(v)}
                />
              )}
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="h-full">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Supply vs settled</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    requested vs delivered kg · last {range} months
                  </p>
                </div>
                <SegmentedTabs<"6" | "3">
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "6", label: "6M" },
                    { value: "3", label: "3M" },
                  ]}
                />
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--c-sky)" }} />
                  Requested
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--c-brand)" }} />
                  Settled
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : monthly.length === 0 || monthly.every((m) => m.requestedKg === 0 && m.deliveredKg === 0) ? (
                <EmptyState icon={<Scale className="h-6 w-6" />} title="No monthly activity yet" />
              ) : (
                <GroupedBarChart
                  labels={monthly.map((m) => m.month)}
                  series={[
                    { name: "Requested", values: monthly.map((m) => m.requestedKg), color: "var(--c-sky)" },
                    { name: "Settled", values: monthly.map((m) => m.deliveredKg), color: "var(--c-brand)" },
                  ]}
                  height={260}
                  formatValue={(v) => `${Math.round(v).toLocaleString()} kg`}
                />
              )}
            </Card>
          </div>
        </motion.div>

        {/* Demand bubbles + recent settlements */}
        <motion.div variants={pageItem} className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="h-full">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Supply requests</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">requested kg by material · fulfilment</p>
              </div>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-24 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : demand.length === 0 ? (
                <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No supply requests yet" />
              ) : (
                <div className="space-y-5">
                  <BubbleCloud items={demandBubbles} />
                  <ul className="space-y-3">
                    {demand.slice(0, 5).map((d, i) => {
                      const pct =
                        d.requestedKg > 0 ? Math.min(100, Math.round((d.fulfilledKg / d.requestedKg) * 100)) : 0;
                      return (
                        <li key={d.name}>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: PALETTE[i % PALETTE.length] }}
                            />
                            <span className="truncate font-semibold text-slate-600 dark:text-slate-300">
                              {d.name}
                            </span>
                            <span className="ml-auto whitespace-nowrap font-bold text-slate-900 dark:text-white">
                              {Math.round(d.fulfilledKg).toLocaleString()} / {Math.round(d.requestedKg).toLocaleString()} kg
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: PALETTE[i % PALETTE.length] }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.25 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="h-full">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent settlements</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">latest deliveries, newest first</p>
                </div>
                <span className="text-xs font-semibold text-slate-400">{recent.length} latest</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Table
                  columns={columns}
                  rows={recent}
                  rowKey={(r) => r.id}
                  dense
                  empty={
                    <EmptyState
                      title="No settlements yet"
                      subtitle="Settled pickups delivered to your hub will appear here."
                      className="mt-3"
                    />
                  }
                />
              )}
            </Card>
          </div>
        </motion.div>
    </PageMotion>
  );
}
