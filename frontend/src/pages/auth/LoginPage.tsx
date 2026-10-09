import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Factory,
  HeartHandshake,
  Home,
  Landmark,
  Recycle,
  ShieldCheck,
  Truck,
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Blurred photo backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/baban-bola.jpg)" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-900/5 sm:max-w-6xl lg:min-h-[calc(100dvh-4rem)] lg:max-w-7xl lg:grid-cols-[2fr_3fr] dark:bg-slate-900 dark:ring-white/10">
          {/* ── Form panel ── */}
          <div className="flex flex-col justify-center px-7 py-10 sm:px-10 sm:py-12 xl:px-16 xl:py-14">
            <a href="/" className="mb-7 flex items-center justify-start gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                <Recycle className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="leading-tight">
                <span className="block whitespace-nowrap text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                  InteliScrap AI
                </span>
                <span className="block whitespace-nowrap text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  Circular economy marketplace
                </span>
              </span>
            </a>

            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-3xl xl:text-4xl dark:text-white">
              {step === "role" ? (
                <>
                  Welcome back.
                  <br />
                  Let&apos;s get you collecting.
                </>
              ) : (
                "Enter the code"
              )}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {step === "role"
                ? "Choose how you use InteliScrap, then verify your phone — we'll text you a 6-digit code."
                : `A 6-digit code was sent to ${phone}.`}
            </p>

            {step === "role" ? (
              <div className="mt-6 space-y-5">
                <div
                  role="radiogroup"
                  aria-label="Account role"
                  className="grid grid-cols-2 gap-2.5"
                  onKeyDown={(e) => {
                    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
                    e.preventDefault();
                    const idx = ROLES.findIndex((r) => r.role === role);
                    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                    const next = ROLES[(idx + delta + ROLES.length) % ROLES.length];
                    if (next) {
                      setRole(next.role);
                      const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                      buttons[(idx + delta + ROLES.length) % ROLES.length]?.focus();
                    }
                  }}
                >
                  {ROLES.map((r) => {
                    const active = role === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
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
                    className="input rounded-full border-transparent bg-slate-100 px-5 py-3 dark:border-transparent dark:bg-slate-800"
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

                <Button fullWidth size="lg" className="rounded-full" onClick={sendCode} loading={busy} disabled={!validPhone}>
                  Send verification code
                </Button>

                <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                  New here? Your account is created automatically when you verify — no
                  passwords to forget.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {debugOtp && (
                  <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
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
                    className="input rounded-full border-transparent bg-slate-100 px-5 py-3.5 text-center font-mono text-lg tracking-[0.4em] dark:border-transparent dark:bg-slate-800"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                  />
                </div>
                {error && <ErrorNote message={error} />}
                <Button fullWidth size="lg" className="rounded-full" onClick={confirmOtp} loading={busy} disabled={otp.length !== 6}>
                  Verify &amp; continue
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep("role"); setOtp(""); setError(null); }}
                  className="block w-full text-center text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Change phone / role
                </button>
              </div>
            )}
          </div>

          {/* ── Image panel — inset from the card with its own inner radius ── */}
          <div className="relative hidden p-3 lg:block">
            <div className="relative h-full w-full overflow-hidden rounded-[20px]">
              <img
                src="/baban-bola.jpg"
                alt="A Baban Bola collector buying scrap from a seller on a Lagos street"
                className="absolute inset-0 h-full w-full object-cover object-[50%_58%]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-950/20"
              />

              {/* Map-pin marker → chip */}
              <div className="absolute left-8 top-6 flex flex-col items-start">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/90 bg-white/40 shadow-md backdrop-blur" />
                <span className="h-9 w-px bg-white/60" aria-hidden="true" />
                <span className="rounded-full bg-white/15 px-3.5 py-2 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                  Lagos · live market prices
                </span>
              </div>

              {/* Stat card */}
              <div className="absolute right-6 top-1/3 rounded-2xl bg-white/15 px-4 py-3 text-white ring-1 ring-white/25 backdrop-blur-md">
                <p className="text-lg font-extrabold leading-none">94%</p>
                <p className="mt-1 text-[11px] font-semibold leading-tight text-white/80">
                  material accuracy, fully on-device
                </p>
              </div>

              {/* Bottom pill */}
              <span className="absolute bottom-7 left-8 rounded-full bg-white/15 px-3.5 py-2 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                Nigeria&apos;s major languages
              </span>
            </div>
          </div>
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
