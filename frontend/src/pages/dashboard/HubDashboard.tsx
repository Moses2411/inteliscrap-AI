import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Crown,
  PackagePlus,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PreviewPill } from "../../components/ui/PreviewPill";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/Progress";
import { Table, type Column } from "../../components/ui/Table";
import { Sheet } from "../../components/ui/Sheet";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageMotion, pageItem, pageStagger } from "../../components/ui/PageMotion";
import { useHubData, useMarketData } from "../../hooks/useDashboardData";
import { createHubRequest } from "../../services/hubs";
import { formatKg, formatNaira, formatDateTime } from "../../utils/formatters";
import { cn } from "../../lib/cn";

export default function HubDashboard() {
  const hub = useHubData();
  const market = useMarketData();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ material_category_id: "", requested_kg: "", note: "", requested_on: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const data = hub.data;
  const requests = data?.requests ?? [];
  const deliveries = data?.deliveries ?? [];
  const subscriptions = data?.subscriptions ?? [];
  const openRequests = requests.filter((r) => r.status === "open");
  const activeSub = subscriptions.find((s) => s.status === "active");

  const deliveredKg = deliveries.reduce((a, d) => a + d.weight_kg, 0);
  const fulfillment =
    openRequests.length > 0
      ? openRequests.reduce((a, r) => a + (r.requested_kg > 0 ? r.fulfilled_kg / r.requested_kg : 0), 0) /
        openRequests.length
      : 0;

  const materials = market.data?.materials ?? [];

  const submit = useCallback(async () => {
    setFormError(null);
    if (!form.material_category_id || !form.requested_kg || !form.requested_on) {
      setFormError("Material, quantity and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createHubRequest({
        material_category_id: Number(form.material_category_id),
        requested_kg: Number(form.requested_kg),
        requested_on: new Date(form.requested_on).toISOString(),
        note: form.note || undefined,
      });
      setSaved(true);
      setTimeout(() => setSheetOpen(false), 600);
      hub.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to publish request");
    } finally {
      setSubmitting(false);
    }
  }, [form, hub]);

  const deliveryColumns: Column<(typeof deliveries)[number]>[] = [
    {
      key: "txn",
      label: "Transaction",
      render: (d) => (
        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{d.transaction_id}</span>
      ),
    },
    {
      key: "material",
      label: "Material",
      render: (d) => {
        const m = materials.find((x) => x.id === d.material_category_id);
        return <span className="font-semibold text-slate-800 dark:text-slate-100">{m?.name ?? `#${d.material_category_id}`}</span>;
      },
    },
    { key: "weight", label: "Weight", align: "right", render: (d) => formatKg(d.weight_kg) },
    { key: "value", label: "Hub price", align: "right", render: (d) => formatNaira(d.hub_price_naira) },
    {
      key: "time",
      label: "Delivered",
      align: "right",
      render: (d) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {d.delivered_at ? formatDateTime(d.delivered_at) : "—"}
        </span>
      ),
    },
  ];

  return (
    <PageMotion className="space-y-6">
      <motion.div variants={pageItem}>
        <PageHeader
          title={data?.hub?.name ?? "Hub desk"}
          subtitle={
            data?.hub
              ? `${data.hub.city} · ${data.hub.address_text ?? "address pending"}`
              : "Manage daily buy requests, deliveries and subscriptions"
          }
          actions={
            <div className="flex items-center gap-2">
              {hub.isPreview && <PreviewPill />}
              <Button variant="secondary" size="sm" onClick={hub.refresh}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => { setSaved(false); setSheetOpen(true); }}>
                <PackagePlus className="h-3.5 w-3.5" />
                New buy request
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* KPI row */}
      <motion.div variants={pageStagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Open requests"
            value={hub.loading ? "—" : openRequests.length}
            icon={<PackagePlus className="h-5 w-5" />}
            hint="Today's demand"
          />
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Fulfilment"
            value={hub.loading ? "—" : `${Math.round(fulfillment * 100)}%`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300"
            hint={openRequests.length ? "Across open requests" : "No open requests"}
          >
            {!hub.loading && openRequests.length > 0 && (
              <div className="mt-3">
                <ProgressBar value={fulfillment * 100} tone="green" />
              </div>
            )}
          </StatCard>
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Delivered to hub"
            value={hub.loading ? "—" : formatKg(deliveredKg)}
            icon={<Warehouse className="h-5 w-5" />}
            iconClass="bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300"
            hint={`${deliveries.length} settled deliveries`}
          />
        </motion.div>
        <motion.div variants={pageItem} className="min-w-0">
          <StatCard
            label="Subscription"
            value={hub.loading ? "—" : activeSub ? activeSub.plan_name : "None"}
            icon={<Crown className="h-5 w-5" />}
            iconClass="bg-gold-50 text-gold-600 dark:bg-gold-950/80 dark:text-gold-300"
            hint={activeSub?.next_billing_at ? `Next billing ${formatDateTime(activeSub.next_billing_at)}` : "Start Pro plan"}
          />
        </motion.div>
      </motion.div>

      <motion.div variants={pageItem} className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* Demand board */}
        <div className="space-y-4 lg:col-span-3">
          <Card pad>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily buy requests</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Collectors see this live and route the right material to you
                </p>
              </div>
              <Badge tone="brand">{requests.length} requests</Badge>
            </div>

            {hub.loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <Skeleton className="mb-2 h-4 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title="No buy requests yet"
                subtitle="Publish your first daily request so collectors know what you need."
                action={<Button size="sm" onClick={() => setSheetOpen(true)}>New request</Button>}
              />
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => {
                  const pct = r.requested_kg > 0 ? (r.fulfilled_kg / r.requested_kg) * 100 : 0;
                  const filled = r.status === "filled";
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-3.5 transition-colors",
                        filled
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
                          : "border-slate-100 hover:border-brand-200 dark:border-slate-800",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {r.material_name}
                          </span>
                          {r.status === "filled" ? (
                            <Badge tone="green">
                              <CheckCircle2 className="h-3 w-3" /> filled
                            </Badge>
                          ) : (
                            <Badge tone="brand">open</Badge>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                          {formatKg(r.fulfilled_kg)} / {formatKg(r.requested_kg)}
                        </span>
                      </div>
                      <ProgressBar value={pct} tone={filled ? "green" : "brand"} />
                      {r.note && (
                        <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">“{r.note}”</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card pad>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Settled deliveries</h2>
              <Badge tone="slate">{deliveries.length}</Badge>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Traceable collections that fed this hub — your EPR audit trail
            </p>
            {deliveries.length ? (
              <Table
                columns={deliveryColumns}
                rows={deliveries}
                rowKey={(d) => d.id}
                dense
                empty={<EmptyState icon={<Warehouse className="h-6 w-6" />} title="No deliveries yet" />}
              />
            ) : (
              <EmptyState
                icon={<Warehouse className="h-6 w-6" />}
                title="Deliveries appear here"
                subtitle="Each settled pickup that matches this hub is linked automatically."
              />
            )}
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4 lg:col-span-2">
          <Card gradient pad>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">{data?.hub?.name ?? "Your recycling hub"}</p>
                <p className="text-xs text-brand-100">{data?.hub?.city ?? "Register to start buying"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5 backdrop-blur">
              <span className="text-xs font-bold text-white">Hub profile</span>
              <Badge tone="green" className="bg-white/15 text-white ring-white/20">EPR-ready</Badge>
            </div>
          </Card>

          <Card pad>
            <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Subscription</h2>
            {activeSub ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{activeSub.plan_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Amount</span>
                  <span className="text-sm font-bold">{formatNaira(activeSub.amount_naira)}<span className="text-[10px] text-slate-500 dark:text-slate-400">/{activeSub.cycle}</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Next billing</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {activeSub.next_billing_at ? formatDateTime(activeSub.next_billing_at) : "—"}
                  </span>
                </div>
                <Button variant="secondary" size="sm" fullWidth className="!mt-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Renew / upgrade
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<Crown className="h-6 w-6" />}
                title="No active plan"
                subtitle="Pro gives you unlimited buy requests and EPR export."
                action={<Button size="sm">Subscribe — ₦25,000/mo</Button>}
              />
            )}
          </Card>
        </div>
      </motion.div>

      {/* New buy request sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Publish a daily buy request"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="secondary" fullWidth onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button fullWidth onClick={submit} loading={submitting}>
              {saved ? "Published ✓" : "Publish request"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
              {formError}
            </div>
          )}
          {saved && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Request published — collectors in your hex ring will see it live.
            </div>
          )}

          <div>
            <label className="label" htmlFor="hub-material">Material</label>
            <select
              id="hub-material"
              value={form.material_category_id}
              onChange={(e) => setForm({ ...form, material_category_id: e.target.value })}
              className="input"
            >
              <option value="">Select material…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {formatNaira(m.price_per_kg_naira)}/kg
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="hub-kg">Quantity needed (kg)</label>
            <input
              id="hub-kg"
              type="number"
              min={1}
              placeholder="e.g. 500"
              className="input"
              value={form.requested_kg}
              onChange={(e) => setForm({ ...form, requested_kg: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="hub-date">Request for date</label>
            <input
              id="hub-date"
              type="date"
              className="input"
              value={form.requested_on}
              onChange={(e) => setForm({ ...form, requested_on: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="hub-note">Note (optional)</label>
            <textarea
              id="hub-note"
              rows={2}
              placeholder="e.g. Dry batteries only, no cracked cases"
              className="input resize-none"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <Calendar className="h-3 w-3" />
            Buy requests power the live demand board for collectors.
          </p>
        </div>
      </Sheet>
    </PageMotion>
  );
}