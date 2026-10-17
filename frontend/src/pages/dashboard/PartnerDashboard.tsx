import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Download,
  FileText,
  Leaf,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { Table, type Column } from "../../components/ui/Table";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { MomoCheckout } from "../../components/payments/MomoCheckout";
import { useComplianceData } from "../../hooks/useDashboardData";
import { type ManifestoItem } from "../../services/compliance";
import { fetchSubscriptionStatus, premiumPlanForRole, type SubscriptionStatus } from "../../services/subscription";
import { getRole } from "../../services/auth";
import { formatCompactNaira, formatKg, formatDateTime } from "../../utils/formatters";

export default function PartnerDashboard() {
  const compliance = useComplianceData();
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const role = getRole();
  const planInfo = premiumPlanForRole(role);
  const hasData = sub?.data_access ?? false;
  const data = compliance.data;

  useEffect(() => {
    fetchSubscriptionStatus()
      .then(setSub)
      .catch(() => {});
  }, []);

  const downloadJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifesto-${data.generated_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const columns: Column<ManifestoItem>[] = [
    { key: "material", label: "Material", render: (row) => row.material_name },
    {
      key: "weight",
      label: "Weight",
      align: "right",
      render: (row) => <span className="font-semibold">{formatKg(row.weight_kg)}</span>,
    },
    {
      key: "value",
      label: "Gross value",
      align: "right",
      render: (row) => formatCompactNaira(row.gross_value_naira),
    },
    { key: "co2", label: "CO₂e", align: "right", render: (row) => `${row.carbon_offset_kg_co2e.toFixed(1)} kg` },
    {
      key: "hub",
      label: "Hub",
      render: (row) => row.hub ?? <span className="text-slate-400">direct</span>,
    },
    {
      key: "settled",
      label: "Settled",
      align: "right",
      render: (row) => (
        <span className="text-xs text-slate-400">{row.settled_at ? formatDateTime(row.settled_at) : "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="EPR compliance manifest"
        subtitle="Auditable, source-verifiable export of every settled collection for PROs & regulators."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {hasData && compliance.isPreview && <PreviewPill />}
            <Button variant="secondary" size="sm" onClick={compliance.refresh} disabled={!hasData}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={downloadJson} disabled={!data}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
          </div>
        }
      />

      {sub === null ? (
        <Card pad>
          <Skeleton className="h-28 w-full" />
        </Card>
      ) : !hasData ? (
        <Card pad>
          <div className="mx-auto max-w-md py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
              {planInfo ? `${planInfo.name} unlocks this data` : "Premium access required"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Access to the EPR compliance manifest is subscription-based — there is no API key to paste.
              {planInfo ? ` Subscribe to ${planInfo.name} to load the network-wide manifest.` : ""}
            </p>
            {planInfo && (
              <Button className="mt-4" variant="gold" onClick={() => setCheckoutOpen(true)}>
                <Crown className="h-4 w-4" /> Subscribe to {planInfo.name}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* KPI row - mobile responsive */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Settled transactions"
              value={compliance.loading || !data ? "—" : data.total_transactions.toLocaleString()}
              icon={<FileText className="h-5 w-5" />}
              hint="In this manifest"
            />
            <StatCard
              label="Total tonnage"
              value={compliance.loading || !data ? "—" : formatKg(data.total_tonnage_kg)}
              icon={<Scale className="h-5 w-5" />}
              iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300"
            />
            <StatCard
              label="Carbon offset"
              value={compliance.loading || !data ? "—" : `${Math.round(data.total_carbon_offset_kg_co2e).toLocaleString()} kg`}
              icon={<Leaf className="h-5 w-5" />}
              iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
              hint="CO₂e avoided"
            />
            <StatCard
              label="Collector income"
              value={compliance.loading || !data ? "—" : formatCompactNaira(data.total_collector_income_naira)}
              icon={<Wallet className="h-5 w-5" />}
              iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
            />
          </div>

          {/* Responsive grid: table full width on mobile, sidebar on desktop */}
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Manifest table */}
            <Card pad className="lg:col-span-3">
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Manifest items</h2>
                {data && (
                  <Badge tone="green">
                    <ShieldCheck className="h-3 w-3" /> {data.partner_name}
                  </Badge>
                )}
              </div>
              {compliance.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : data ? (
                <Table columns={columns} rows={data.items} rowKey={(r) => r.transaction_id} empty={<EmptyState title="No items in range" />} />
              ) : (
                <EmptyState
                  icon={<ShieldCheck className="h-6 w-6" />}
                  title="Could not load the manifest"
                  subtitle={compliance.error ?? "Please refresh and try again."}
                />
              )}
            </Card>

            {/* Subscription panel */}
            <Card pad className="lg:col-span-1">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Crown className="h-4 w-4 text-amber-500" />
                {sub.plan_name ?? "Premium"}
              </h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Your subscription unlocks the network-wide EPR manifest. No API key required.
              </p>
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <p className="font-semibold">Data access active</p>
                {sub.expires_at && <p className="mt-0.5">Renews {new Date(sub.expires_at).toLocaleDateString()}</p>}
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <p className="font-bold text-slate-600 dark:text-slate-300">Did you know?</p>
                This endpoint is read-only and satisfies EPR audit contracts — every row links a
                material, weight, value and originating hub.
              </div>
            </Card>
          </div>
        </>
      )}

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
            fetchSubscriptionStatus().then(setSub).catch(() => {});
            compliance.refresh();
          }}
        />
      )}
    </div>
  );
}
