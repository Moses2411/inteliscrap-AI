import { useCallback, useState } from "react";
import {
  Download,
  FileText,
  KeyRound,
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
import { useComplianceData } from "../../hooks/useDashboardData";
import {
  fetchManifesto,
  getPartnerApiKey,
  setPartnerApiKey,
  type ManifestoItem,
} from "../../services/compliance";
import { formatCompactNaira, formatKg, formatDateTime } from "../../utils/formatters";
import { cn } from "../../lib/cn";

export default function PartnerDashboard() {
  const compliance = useComplianceData();
  const [key, setKey] = useState(getPartnerApiKey() ?? "");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const data = compliance.data;

  const saveKey = useCallback(async () => {
    setKeyBusy(true);
    setKeyError(null);
    setKeySaved(false);
    try {
      setPartnerApiKey(key.trim());
      await fetchManifesto(); // validate against the API
      setKeySaved(true);
      compliance.refresh();
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Invalid API key");
    } finally {
      setKeyBusy(false);
    }
  }, [key, compliance]);

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
    {
      key: "txn",
      label: "Transaction",
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{row.transaction_id}</span>
      ),
    },
    {
      key: "collector",
      label: "Collector",
      render: (row) => (
        <span className="font-semibold text-slate-800 dark:text-slate-100">{row.collector_phone}</span>
      ),
    },
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
          <div className="flex items-center gap-2">
            {compliance.isPreview && <PreviewPill />}
            <Button variant="secondary" size="sm" onClick={compliance.refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={downloadJson} disabled={!data}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Settled transactions"
          value={compliance.loading || !data ? "—" : data.total_transactions.toLocaleString()}
          icon={<FileText className="h-5 w-5" />}
          hint="in this manifest"
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Manifest table */}
        <Card pad className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
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
              icon={<KeyRound className="h-6 w-6" />}
              title="Connect your API key"
              subtitle="Paste the key issued to your PRO/EPR account to load the manifest."
            />
          )}
        </Card>

        {/* API key */}
        <Card pad className="lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <KeyRound className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            Compliance API key
          </h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Issued to registered PROs, recyclers and FG/EPR auditors. Stored only on this device.
          </p>

          <label className="label" htmlFor="api-key">X-API-Key</label>
          <input
            id="api-key"
            type="password"
            className="input"
            placeholder="paste API key…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />

          {keyError && (
            <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
              {keyError}
            </p>
          )}
          {keySaved && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Key verified — manifest loaded ✓
            </p>
          )}

          <Button className="!mt-3" fullWidth onClick={saveKey} loading={keyBusy} disabled={!key.trim()}>
            {keyBusy ? "Verifying…" : "Save & load manifest"}
          </Button>

          <div className={cn("mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400")}>
            <p className="font-bold text-slate-600 dark:text-slate-300">Did you know?</p>
            This endpoint is read-only and satisfies EPR audit contracts — every row links a
            collector, material, weight, value and originating hub.
          </div>
        </Card>
      </div>
    </div>
  );
}