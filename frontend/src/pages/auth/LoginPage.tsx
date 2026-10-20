import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Factory,
  Globe,
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
  { role: "collector", label: "Collector", blurb: "Get offers & pick up scrap", icon: <Truck className="h-4 w-4" />, requiresAddress: true },
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
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{ backgroundImage: "url(/baban-bola.jpg)", filter: "blur(28px)" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/55" />

      <div className="relative flex min-h-screen items-center justify-center p-3 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-900/5 lg:max-w-6xl lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-4 2xl:max-w-7xl dark:bg-slate-900 dark:ring-white/10">
          {/* Photo panel (desktop only) */}
          <div
            aria-hidden="true"
            className="relative hidden overflow-hidden bg-cover bg-center bg-no-repeat lg:block"
            style={{ backgroundImage: "url(/baban-bola.jpg)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/10 via-transparent to-slate-950/30" />

            <div className="absolute left-[10%] top-[16%] flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <MapPin className="h-3.5 w-3.5" />
              </span>
              Zaria Market
            </div>

            <div className="absolute right-[8%] top-[42%] rounded-2xl bg-white/85 px-4 py-3 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-sm">
              <p className="text-base font-extrabold leading-none text-brand-700">94%</p>
              <p className="mt-1 font-medium text-slate-600">material accuracy</p>
            </div>

            <div className="absolute bottom-[12%] left-[16%] flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Globe className="h-3.5 w-3.5" />
              </span>
              Nigeria&apos;s major languages
            </div>
          </div>

          {/* Form */}
          <div className="flex items-center justify-center px-6 py-8 sm:px-10 lg:px-10 lg:py-12">
            <div className="w-full max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30">
                  <Recycle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">InteliScrap AI</p>
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">Market &amp; Pickup</p>
                </div>
              </div>

              <h2 className="mt-7 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                {step === "role" ? "Welcome back" : step === "otp" ? "Enter the code" : "Register your hub"}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {step === "role"
                  ? "Choose how you use InteliScrap, then verify your phone — we'll text you a 6-digit code."
                  : step === "otp"
                    ? `A 6-digit code was sent to ${phone}.`
                    : "Almost there — tell us about your recycling hub so you can start publishing buy requests."}
              </p>

              {step === "role" ? (
                <div className="mt-6 space-y-4">
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
                            "relative flex flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.98]",
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
                          <span className="text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100">{r.label}</span>
                          <span className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">{r.blurb}</span>
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

                  {/* Address for sellers and collectors — kept mounted but collapsed
                      for other roles so the layout never jumps when switching. */}
                  <div
                    className={cn(
                      "transition-all duration-300 ease-out",
                      addressRequired ? "grid grid-rows-[1fr] opacity-100" : "grid grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <label className="label" htmlFor="address">
                        {role === "collector" ? "Your area / address" : "Pickup address"}
                      </label>
                      <input
                        id="address"
                        type="text"
                        placeholder="e.g. Samaru, Zaria"
                        className="input rounded-full border-transparent bg-slate-100 px-5 py-3 dark:border-transparent dark:bg-slate-800"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required={addressRequired}
                        aria-hidden={!addressRequired}
                        tabIndex={addressRequired ? 0 : -1}
                      />
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {role === "collector"
                          ? "Used to match you with nearby pickups when GPS is off — your exact location stays private."
                          : "Required for pickup scheduling. Used to match you with nearby collectors."}
                      </p>
                    </div>
                  </div>

                  {/* Reserved slot for error + phone warning — keeps button position static (CLS) */}
                  <div className="min-h-[3.5rem] pt-1" aria-live="polite">
                    {error && <ErrorNote message={error} />}

                    {phone && !validPhone && (
                      <p className="text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Enter a valid phone number, e.g. +234 801 234 5678
                      </p>
                    )}
                  </div>

                  <Button
                    fullWidth
                    size="lg"
                    className="rounded-full bg-gradient-to-r from-brand-400 to-brand-600 font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-500 hover:to-brand-700 dark:from-brand-500 dark:to-brand-700"
                    onClick={sendCode}
                    loading={busy}
                    disabled={!validPhone || (addressRequired && !validAddress)}
                  >
                    Send verification code
                  </Button>

                  <p className="text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
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
                      className="input rounded-full border-transparent bg-slate-100 px-5 py-3 text-center text-2xl font-bold tracking-widest dark:border-transparent dark:bg-slate-800"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </div>

                  {/* Reserved slot for error — keeps button position static (CLS) */}
                  <div className="min-h-[3rem]" aria-live="polite">
                    {error && <ErrorNote message={error} />}
                  </div>

                  <Button
                    fullWidth
                    size="lg"
                    className="rounded-full bg-gradient-to-r from-brand-400 to-brand-600 font-bold text-white shadow-lg shadow-brand-500/25 hover:from-brand-500 hover:to-brand-700 dark:from-brand-500 dark:to-brand-700"
                    onClick={confirmOtp}
                    loading={busy}
                    disabled={otp.length !== 6}
                  >
                    Verify &amp; continue
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
