import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleX,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Sheet } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { getSavedPhone } from "../../services/auth";
import {
  fetchMomoConfig,
  refreshPaymentStatus,
  startMomoCheckout,
  type MomoCheckout as MomoCheckoutData,
  type MomoConfig,
  type PaymentPurpose,
  type PaymentStatus,
} from "../../services/payments";
import { formatNaira } from "../../utils/formatters";

type Phase = "form" | "pending" | "success" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
  purpose: PaymentPurpose;
  plan: string;
  /** Price shown to the user, in naira. */
  amountNaira: number;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30; // ~2 minutes

/**
 * MTN MoMo Request-to-Pay checkout.
 *
 * Collects the payer's number, starts a payment on the server, then waits for
 * the payer to approve the prompt. Status is polled through the backend (which
 * asks MoMo directly) so it works even without a public callback URL.
 */
export function MomoCheckout({
  open,
  onClose,
  purpose,
  plan,
  amountNaira,
  title = "Pay with MTN MoMo",
  description,
  onSuccess,
}: Props) {
  const [config, setConfig] = useState<MomoConfig | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<MomoCheckoutData | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [polls, setPolls] = useState(0);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const successFiredRef = useRef(false);

  // Load config + reset whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setError(null);
    setCheckout(null);
    setStatus(null);
    setTimedOut(false);
    setPolls(0);
    successFiredRef.current = false;
    setPhone((prev) => prev || getSavedPhone() || "");
    let active = true;
    fetchMomoConfig()
      .then((c) => active && setConfig(c))
      .catch(() => active && setConfig({ enabled: false, environment: "unknown", currency: "", callback_configured: false }));
    return () => {
      active = false;
    };
  }, [open]);

  // Poll while a payment is pending.
  useEffect(() => {
    if (phase !== "pending" || !checkout) return;
    if (polls >= MAX_POLLS) {
      setTimedOut(true);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await refreshPaymentStatus(checkout.reference_id);
        if (!active) return;
        setStatus(next);
        setPolls((p) => p + 1);
        if (next.status === "successful") {
          setPhase("success");
          if (!successFiredRef.current) {
            successFiredRef.current = true;
            onSuccessRef.current?.();
          }
        } else if (next.status === "failed" || next.status === "cancelled") {
          setPhase("failed");
        }
      } catch {
        if (active) setPolls((p) => p + 1);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [phase, checkout, polls]);

  const pay = useCallback(async () => {
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Enter the mobile money number to charge.");
      return;
    }
    setBusy(true);
    try {
      const result = await startMomoCheckout({ plan, phone_number: trimmed, purpose });
      setCheckout(result);
      setStatus(null);
      setTimedOut(false);
      setPolls(0);
      setPhase("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }, [phone, plan, purpose]);

  const checkAgain = useCallback(() => {
    setTimedOut(false);
    setPolls(0);
  }, []);

  const retry = useCallback(() => {
    setPhase("form");
    setCheckout(null);
    setStatus(null);
    setError(null);
    setTimedOut(false);
    setPolls(0);
  }, []);

  const momoOff = config !== null && !config.enabled;
  const configLoading = config === null;

  // Payments aren't wired up on this build — show a friendly "coming soon"
  // popup instead of the checkout form.
  if (open && momoOff) {
    return (
      <Modal open onClose={onClose} title="Payment integration coming soon">
        <p>
          Mobile money payments aren&apos;t available just yet — we&apos;re still
          finishing the MTN MoMo integration. Please check back soon.
        </p>
        <Button className="mt-4" fullWidth onClick={onClose}>
          Got it
        </Button>
      </Modal>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-800/60">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {plan} plan
            </p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">
              {formatNaira(amountNaira)}
            </p>
          </div>
          <Badge tone="gold">
            <Smartphone className="h-3 w-3" /> MoMo
          </Badge>
        </div>

        {description && phase === "form" && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        )}

        {phase === "form" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                MTN MoMo number
              </span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={momoOff}
              />
            </label>
            {error && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <Button fullWidth onClick={pay} loading={busy} disabled={momoOff || configLoading || !phone.trim()}>
              Pay {formatNaira(amountNaira)}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3 w-3" /> You&apos;ll get a prompt on your phone to approve.
            </p>
          </>
        )}

        {phase === "pending" && (
          <div className="py-4 text-center">
            {timedOut ? (
              <>
                <RefreshCw className="mx-auto h-9 w-9 text-amber-500" />
                <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">Still waiting…</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  We haven&apos;t seen your approval yet. Approve the prompt on your phone,
                  then check again.
                </p>
                <Button className="mt-4" fullWidth onClick={checkAgain}>
                  Check again
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-500" />
                <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">
                  Approve the prompt on your phone
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  A payment request for {formatNaira(amountNaira)} was sent to{" "}
                  <span className="font-semibold">{status?.payer_msisdn ?? checkout?.payer_msisdn}</span>.
                </p>
                <Button variant="ghost" className="mt-4" fullWidth onClick={onClose}>
                  Close and finish later
                </Button>
              </>
            )}
          </div>
        )}

        {phase === "success" && (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-500" />
            <p className="mt-3 font-bold text-slate-900 dark:text-white">Payment received</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your {plan} plan is active
              {status?.provider_financial_tx_id ? ` · ref ${status.provider_financial_tx_id}` : ""}.
            </p>
            <Button className="mt-4" fullWidth onClick={onClose}>
              Done
            </Button>
          </div>
        )}

        {phase === "failed" && (
          <div className="py-4 text-center">
            <CircleX className="mx-auto h-11 w-11 text-red-500" />
            <p className="mt-3 font-bold text-slate-900 dark:text-white">Payment didn&apos;t go through</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {status?.failure_reason || "The request was declined or timed out."}
            </p>
            <Button className="mt-4" fullWidth onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
