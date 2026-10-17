import { useState, type FormEvent } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import {
  getRole,
  getSavedPhone,
  requestOtp,
  verifyOtp,
  type UserRole,
} from "../../services/auth";
import { createListing, checkListingAllowed } from "../../services/listings";
import { getCategoryBySlug } from "../../services/materials";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { MomoCheckout } from "../payments/MomoCheckout";
import type { VisionAnalysis } from "../../types";

interface Props {
  analysis: VisionAnalysis;
  onReset: () => void;
}

function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string; requiresAddress: boolean }[] = [
  { value: "seller", label: "Seller", hint: "I have scrap to sell", requiresAddress: true },
  { value: "collector", label: "Collector", hint: "I pick up scrap", requiresAddress: false },
];

export default function PostPickupForm({ analysis, onReset }: Props) {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(!!getRole());
  const [role, setRole] = useState<UserRole>("seller");
  const [phone, setPhone] = useState(getSavedPhone() ?? "");
  const [address, setAddress] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [posted, setPosted] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [canList, setCanList] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const currentRoleConfig = ROLE_OPTIONS.find((o) => o.value === role);
  const addressRequired = currentRoleConfig?.requiresAddress ?? false;
  const validAddress = address.trim().length >= 5;

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!otpSent) {
        const { otp: returnedOtp, debug } = await requestOtp(phone, role, addressRequired ? address : undefined);
        if (debug && returnedOtp) setDebugOtp(returnedOtp);
        else if (returnedOtp) console.log("Demo OTP:", returnedOtp);
        setOtpSent(true);
      } else {
        await verifyOtp(phone, otp);
        setAuthenticated(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitListing(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Check subscription eligibility
      const eligibility = await checkListingAllowed();
      if (!eligibility.allowed) {
        setSubscriptionError(eligibility.error || "Listing not allowed due to subscription limits");
        setCanList(false);
        setBusy(false);
        return;
      }

      const category = await getCategoryBySlug(analysis.material_slug);
      if (!category) throw new Error("Material category not found");

      let coords: GeolocationCoordinates | null = null;
      let geoError: string | null = null;
      try {
        coords = await getCurrentPosition();
      } catch (err) {
        geoError = "Could not get your location. Listing will be visible on the market but won't auto-dispatch to nearby collectors.";
        console.warn("Geolocation failed:", err);
      }

      await createListing({
        material_category_id: category.id,
        estimated_value_naira: category.price_per_kg_naira, // Use base price per kg as estimate
        confidence_score: analysis.confidence,
        toxicity_hazards: analysis.toxicity_hazards,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        address_text: addressRequired ? address : undefined,
        contact_phone: sharePhone ? phone : undefined,
        auto_dispatch: coords != null,
      });
      if (geoError) setError(geoError);
      setPosted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setBusy(false);
    }
  }

  if (posted) {
    return (
      <Card className="border-l-4 border-l-brand-500 bg-brand-50 text-center ring-brand-200 dark:bg-brand-950/50 dark:ring-brand-900">
        <svg className="mx-auto h-10 w-10 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-2 font-semibold text-brand-800 dark:text-brand-200">{t("posted_success")}</p>
        <p className="mt-1 text-sm text-brand-600 dark:text-brand-400">Collector will weigh and confirm price at pickup.</p>
        <Button fullWidth className="mt-4" onClick={onReset}>
          {t("scan_again")}
        </Button>
      </Card>
    );
  }

  if (!authenticated) {
    return (
      <form onSubmit={submitAuth} className="card space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("sign_in_title")}</h2>
        {!otpSent && (
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Account type"
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
              e.preventDefault();
              const idx = ROLE_OPTIONS.findIndex((o) => o.value === role);
              const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
              const nextIdx = (idx + delta + ROLE_OPTIONS.length) % ROLE_OPTIONS.length;
              const next = ROLE_OPTIONS[nextIdx];
              if (next) {
                setRole(next.value);
                e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIdx]?.focus();
              }
            }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={role === opt.value}
                onClick={() => setRole(opt.value)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  role === opt.value
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:ring-brand-900"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">{opt.hint}</span>
              </button>
            ))}
          </div>
        )}
        <input
          className="input"
          type="tel"
          placeholder={t("your_phone")}
          aria-label={t("your_phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />

        {/* Address field for seller and collector */}
        {addressRequired && (
          <div>
            <label className="label" htmlFor="address">Pickup address</label>
            <input
              id="address"
              type="text"
              placeholder="e.g. 123 Main Street, City"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Required for pickup scheduling. Used to match you with nearby collectors.
            </p>
          </div>
        )}

        <input
          className="input"
          type="tel"
          placeholder={t("your_phone")}
          aria-label={t("your_phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />
        {error && <div className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{error}</div>}

        {otpSent && (
          <>
            {debugOtp && (
              <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                Demo OTP: <code className="font-mono">{debugOtp}</code>
              </div>
            )}
            <input
              className="input rounded-full border-transparent bg-slate-100 px-5 py-3 text-center text-2xl tracking-widest font-bold dark:border-transparent dark:bg-slate-800"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </>
        )}

        <Button fullWidth type="submit" loading={busy} disabled={!phone || (addressRequired && !validAddress) || (otpSent && otp.length !== 6)}>
          {otpSent ? "Verify & continue" : "Send verification code"}
        </Button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          New here? Your account is created automatically when you verify — no passwords to forget.
        </p>
      </form>
    );
  }

  if (!subscriptionChecked) {
    checkListingAllowed().then((result) => {
      setCanList(result.allowed);
      setSubscriptionError(result.error ?? null);
      setSubscriptionChecked(true);
    });
  }

  if (!canList && subscriptionError) {
    return (
      <>
        <Card className="border-l-4 border-l-amber-500 bg-amber-50 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-900">
          <div className="text-center py-6">
            <svg className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="mt-2 font-semibold text-amber-800 dark:text-amber-200">Subscription limit reached</p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{subscriptionError}</p>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Upgrade to Seller Premium (₦4,900/year) for unlimited listings.</p>
            <Button fullWidth className="mt-4" variant="gold" onClick={() => setUpgradeOpen(true)}>
              Upgrade with MTN MoMo
            </Button>
            <Button fullWidth className="mt-2" variant="ghost" onClick={onReset}>
              {t("scan_again")}
            </Button>
          </div>
        </Card>
        <MomoCheckout
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          purpose="user_subscription"
          plan="seller_yearly"
          planLabel="Seller Premium"
          amountNaira={4900}
          title="Upgrade to Seller Premium"
          description="Unlimited listings for a full year. Pay in seconds with MTN MoMo."
          onSuccess={() => {
            setUpgradeOpen(false);
            // Re-check eligibility so the form unlocks without a reload.
            setSubscriptionChecked(false);
            setCanList(true);
            setSubscriptionError(null);
          }}
        />
      </>
    );
  }

  return (
    <form onSubmit={submitListing} className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("confirm_listing")}</h2>
        <span className="text-xs text-brand-600 dark:text-brand-400">{analysis.material_class}</span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t("listing_confirm_desc")}
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
        <span className="text-slate-600 dark:text-slate-300">Share my phone with collector</span>
      </label>

      {subscriptionError && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          {subscriptionError}
        </div>
      )}

      {error && <div className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{error}</div>}

      <Button fullWidth type="submit" loading={busy}>
        {t("list_scrap")}
      </Button>

      <Button variant="ghost" fullWidth type="button" onClick={onReset}>
        {t("scan_again")}
      </Button>
    </form>
  );
}