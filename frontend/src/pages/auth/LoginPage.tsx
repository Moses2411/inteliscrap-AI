import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Factory,
  HeartHandshake,
  Home,
  Landmark,
  Leaf,
  Recycle,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { requestOtp, verifyOtp, type UserRole } from "../../services/auth";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";

const ROLES: Array<{ role: UserRole; label: string; blurb: string; icon: ReactNode }> = [
  { role: "household", label: "Household / Seller", blurb: "Sell scrap at fair prices", icon: <Home className="h-4 w-4" /> },
  { role: "collector", label: "Collector", blurb: "Get offers & pick up scrap", icon: <Truck className="h-4 w-4" /> },
  { role: "recycling_hub", label: "Recycling Hub", blurb: "Buy material at scale", icon: <Factory className="h-4 w-4" /> },
  { role: "ngo", label: "NGO", blurb: "Track community impact", icon: <HeartHandshake className="h-4 w-4" /> },
  { role: "partner", label: "PRO / EPR Partner", blurb: "Compliance manifests", icon: <Landmark className="h-4 w-4" /> },
  { role: "admin", label: "Admin", blurb: "Platform oversight", icon: <ShieldCheck className="h-4 w-4" /> },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

  const [role, setRole] = useState<UserRole>("household");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"role" | "otp">("role");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  // Users type spaces/dashes (the placeholder itself has spaces) — strip them
  // for validation and before sending to the API so lookups match consistently.
  const normalizedPhone = useMemo(() => phone.replace(/[\s\-().]/g, ""), [phone]);
  const validPhone = useMemo(() => /^\+?\d{10,15}$/.test(normalizedPhone), [normalizedPhone]);

  const sendCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDebugOtp(null);
    try {
      const { otp: code, debug } = await requestOtp(normalizedPhone, role);
      if (debug && code) setDebugOtp(code);
      setStep("otp");
    } catch {
      setError("Could not send code. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  }, [normalizedPhone, role]);

  const confirmOtp = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(normalizedPhone, otp.trim());
      navigate(from, { replace: true });
    } catch {
      setError("That code didn't match. Try again.");
    } finally {
      setBusy(false);
    }
  }, [normalizedPhone, otp, navigate, from]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] overflow-hidden bg-cover bg-center bg-no-repeat p-10 text-white lg:flex lg:flex-col lg:justify-between" style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.6), rgba(15,23,42,0.8)), url(/baban-bola.jpg)" }}>
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Recycle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">InteliScrap</p>
            <p className="text-xs font-semibold text-brand-100">Circular economy marketplace</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Every kilogram of scrap, fairly valued.
          </h1>
          <ul className="space-y-3.5">
            <li className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Zap className="h-4 w-4" /></span>
              On-device AI identifies materials &amp; hazards — even offline
            </li>
            <li className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Leaf className="h-4 w-4" /></span>
              Hex-grid dispatch puts offers on collectors' phones
            </li>
            <li className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><ShieldCheck className="h-4 w-4" /></span>
              EPR-auditable manifests for every settled collection
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-brand-100">Proudly built for informal recycling economy.</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Recycle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">InteliScrap</p>
              <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">Market &amp; Pickup</p>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {step === "role" ? "Welcome back" : "Enter the code"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {step === "role"
              ? "Choose how you use InteliScrap, then verify your phone."
              : `A 6-digit code was sent to ${phone}.`}
          </p>

          {step === "role" ? (
            <div className="mt-6 space-y-5">
              <div role="radiogroup" aria-label="Account role" className="grid grid-cols-2 gap-2.5">
                {ROLES.map((r) => {
                  const active = role === r.role;
                  return (
                    <button
                      key={r.role}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRole(r.role)}
                      className={cn(
                        "relative flex flex-col items-start gap-1 rounded-2xl border-2 p-3.5 text-left transition-all duration-150 active:scale-[0.98]",
                        active
                          ? "border-brand-500 bg-brand-50/70 shadow-glow dark:bg-brand-950/50"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                      )}
                    >
                      {active && (
                        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-brand-500/15 text-brand-600 dark:text-brand-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>
                        {r.icon}
                      </span>
                      <span className="mt-1 text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100">{r.label}</span>
                      <span className="text-[11px] leading-tight text-slate-400">{r.blurb}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="label" htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+234 801 234 5678"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {error && <ErrorNote message={error} />}

              {phone && !validPhone && (
                <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Enter a valid phone number, e.g. +234 801 234 5678
                </p>
              )}

              <Button fullWidth size="lg" onClick={sendCode} loading={busy} disabled={!validPhone}>
                Send verification code
              </Button>
              <p className="text-center text-[11px] text-slate-400">
                OTP login keeps collectors' phones — no passwords to forget.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {debugOtp && (
                <div className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                  Demo mode — your code is <span className="font-mono text-sm font-extrabold">{debugOtp}</span>
                </div>
              )}
              <div>
                <label className="label" htmlFor="otp">6-digit code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input text-center font-mono text-lg tracking-[0.4em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                />
              </div>
              {error && <ErrorNote message={error} />}
              <Button fullWidth size="lg" onClick={confirmOtp} loading={busy} disabled={otp.length !== 6}>
                Verify &amp; continue
              </Button>
              <button
                onClick={() => { setStep("role"); setOtp(""); setError(null); }}
                className="block w-full text-center text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
              >
                Change phone / role
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
      {message}
    </p>
  );
}