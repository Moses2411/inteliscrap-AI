import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Factory,
  HeartHandshake,
  Home,
  Landmark,
  MapPin,
  Recycle,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { requestOtp, verifyOtp, type UserRole } from "../../services/auth";
import { fetchMyHubOrNull } from "../../services/hubs";
import { Button } from "../../components/ui/Button";
import HubRegistrationForm from "../../components/Hub/HubRegistrationForm";
import { cn } from "../../lib/cn";

const ROLES: Array<{ role: UserRole; label: string; blurb: string; icon: ReactNode; requiresAddress: boolean }> = [
  { role: "seller", label: "Seller", blurb: "Sell scrap at fair prices", icon: <Home className="h-4 w-4" />, requiresAddress: true },
  { role: "collector", label: "Collector", blurb: "Get offers & pick up scrap", icon: <Truck className="h-4 w-4" />, requiresAddress: false },
  { role: "recycling_hub", label: "Recycling Hub", blurb: "Buy material at scale", icon: <Factory className="h-4 w-4" />, requiresAddress: false },
  { role: "ngo", label: "NGO", blurb: "Track community impact", icon: <HeartHandshake className="h-4 w-4" />, requiresAddress: false },
  { role: "partner", label: "PRO / EPR Partner", blurb: "Compliance manifests", icon: <Landmark className="h-4 w-4" />, requiresAddress: false },
  { role: "admin", label: "Admin", blurb: "Platform oversight", icon: <ShieldCheck className="h-4 w-4" />, requiresAddress: false },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

  const [role, setRole] = useState<UserRole>("seller");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [step, setStep] = useState<"role" | "otp" | "hub">("role");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [roleNote, setRoleNote] = useState<string | null>(null);

  // Users type spaces/dashes (the placeholder itself has spaces) — strip them
  // for validation and before sending to the API so lookups match consistently.
  const normalizedPhone = useMemo(() => phone.replace(/[\s\-().]/g, ""), [phone]);
  const validPhone = useMemo(() => /^\+?\d{10,15}$/.test(normalizedPhone), [normalizedPhone]);
  const currentRoleConfig = ROLES.find((r) => r.role === role);
  const addressRequired = currentRoleConfig?.requiresAddress ?? false;
  const validAddress = address.trim().length >= 5;

  const sendCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDebugOtp(null);
    setRoleNote(null);
    try {
      const { otp: code, debug, retryAfter, role: serverRole, accountExists } = await requestOtp(
        normalizedPhone,
        role,
        addressRequired ? address : undefined,
      );
      if (debug && code) setDebugOtp(code);
      // One phone number = one account type. If this number already has an
      // account, that account's role wins — tell the user before they verify.
      if (accountExists && serverRole && serverRole !== role) {
        setRole(serverRole);
        setRoleNote(
          `This number is already registered as a ${serverRole.replace("_", " ")} account — you'll sign in as that.`,
        );
      }
      setStep("otp");
      setCooldown(retryAfter > 0 ? retryAfter : 30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [normalizedPhone, role, address, addressRequired]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const confirmOtp = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(normalizedPhone, otp.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't match or has expired. Try again.");
      setBusy(false);
      return;
    }

    // A hub account can't do anything until it registers its hub, so collect
    // that here — right after sign-in — instead of failing later with a 403.
    if (role === "recycling_hub") {
      try {
        const existing = await fetchMyHubOrNull();
        if (!existing) {
          setStep("hub");
          setBusy(false);
          return;
        }
      } catch {
        // Can't tell whether a hub exists — continue to the dashboard, which
        // shows the registration form when one is still needed.
      }
    }

    navigate(from, { replace: true });
    setBusy(false);
  }, [normalizedPhone, otp, navigate, from, role]);

  const ErrorNote = ({ message }: { message: string }) => (
    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300" role="alert">
      {message}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Blurred photo backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.75)), url(/baban-bola.jpg)" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-900/5 sm:max-w-6xl lg:min-h-[calc(100dvh-4rem)] lg:max-w-7xl lg:grid-cols-[2fr_3fr] dark:bg-slate-900 dark:ring-white/10">
          {/* Brand panel */}
          <div className="relative hidden w-[46%] overflow-hidden bg-cover bg-center bg-no-repeat p-10 text-white lg:flex lg:flex-col lg:justify-between" style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.6), rgba(15,23,42,0.8)), url(/baban-bola.jpg)" }}>
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-gold-400/20 blur-3xl" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Recycle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">InteliScrap AI</p>
                <p className="text-xs font-semibold text-brand-100">Circular economy marketplace</p>
              </div>
            </div>

            <div className="relative space-y-6">
              <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
                Every kilogram of scrap, fairly valued.
              </h1>
              <ul className="space-y-3.5">
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><MapPin className="h-4 w-4" /></span>
                  Address-based pickup for sellers & collectors
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Recycle className="h-4 w-4" /></span>
                  On-device AI identifies materials & hazards — even offline
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><ShieldCheck className="h-4 w-4" /></span>
                  EPR-auditable manifests for every settled collection
                </li>
              </ul>
            </div>

            <p className="relative text-xs text-brand-100">Built for informal recycling economies worldwide.</p>
          </div>

          {/* Form */}
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <Recycle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">InteliScrap AI</p>
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">Market & Pickup</p>
                </div>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {step === "role" ? "Welcome back" : step === "otp" ? "Enter the code" : "Register your hub"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {step === "role"
                  ? "Choose how you use InteliScrap, then verify your phone — we'll text you a 6-digit code."
                  : step === "otp"
                    ? `A 6-digit code was sent to ${phone}.`
                    : "Almost there — tell us about your recycling hub so you can start publishing buy requests."}
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

                  {/* Address field for seller and collector */}
                  {addressRequired && (
                    <div>
                      <label className="label" htmlFor="address">Pickup address</label>
                      <input
                        id="address"
                        type="text"
                        placeholder="e.g. 123 Main Street, City"
                        className="input rounded-full border-transparent bg-slate-100 px-5 py-3 dark:border-transparent dark:bg-slate-800"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Required for pickup scheduling. Used to match you with nearby collectors.
                      </p>
                    </div>
                  )}

                  <div className="ErrorNote" role="alert" style={error ? {} : { display: 'none' }}>
                    {error && <span>{error}</span>}
                  </div>

                  {phone && !validPhone && (
                    <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Enter a valid phone number, e.g. +234 801 234 5678
                    </p>
                  )}

                  <Button fullWidth size="lg" className="rounded-full" onClick={sendCode} loading={busy} disabled={!validPhone || (addressRequired && !validAddress)}>
                    Send verification code
                  </Button>

                  <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                    New here? Your account is created automatically when you verify — no
                    passwords to forget.
                  </p>
                </div>
              ) : step === "otp" ? (
                <div className="mt-6 space-y-5">
                  {roleNote && (
                    <div className="rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900">
                      {roleNote}
                    </div>
                  )}
                  {debugOtp && (
                    <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                      Demo OTP: <code className="font-mono">{debugOtp}</code>
                    </div>
                  )}

                  <div>
                    <label className="label" htmlFor="otp">Verification code</label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      className="input rounded-full border-transparent bg-slate-100 px-5 py-3 text-center text-2xl tracking-widest font-bold dark:border-transparent dark:bg-slate-800"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\\D/g, ""))}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>

                  {error && <ErrorNote message={error} />}

                  <Button fullWidth size="lg" className="rounded-full" onClick={confirmOtp} loading={busy} disabled={otp.length !== 6}>
                    Verify & continue
                  </Button>

                  <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={busy || cooldown > 0}
                      className="font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-400"
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                    </button>
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <HubRegistrationForm
                    submitLabel="Register hub & continue"
                    onRegistered={() => navigate(from, { replace: true })}
                  />
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                    You can update these details later from your hub desk.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}