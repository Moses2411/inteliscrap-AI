import { useState, type FormEvent } from "react";
import { useTranslation } from "../../hooks/useTranslation";
import {
  getRole,
  getSavedPhone,
  requestOtp,
  verifyOtp,
  type UserRole,
} from "../../services/auth";
import { createListing } from "../../services/listings";
import { getCategoryBySlug } from "../../services/materials";
import { computeFairValue } from "../../services/language";
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

const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: "household", label: "Household", hint: "I have scrap to sell" },
  { value: "collector", label: "Collector", hint: "I pick up scrap" },
];

export default function PostPickupForm({ analysis, onReset }: Props) {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState(!!getRole());
  const [role, setRole] = useState<UserRole>("household");
  const [phone, setPhone] = useState(getSavedPhone() ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [posted, setPosted] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!otpSent) {
        const { otp: returnedOtp } = await requestOtp(phone, role);
        setDemoOtp(returnedOtp ?? null);
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

  async function submitWeight(e: FormEvent) {
    e.preventDefault();
    const cleaned = weight.replace(",", ".").replace(/[^\d.]/g, "");
    const w = Number(cleaned);
    if (!w || w <= 0) {
      setError(t("weight_invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const category = await getCategoryBySlug(analysis.material_slug);
      if (!category) throw new Error("Material category not found");

      let coords: GeolocationCoordinates | null = null;
      try {
        coords = await getCurrentPosition();
      } catch {
        // location optional — listing can still be created without coordinates
      }

      await createListing({
        material_category_id: category.id,
        estimated_weight_kg: Number(w.toFixed(3)),
        estimated_value_naira: computeFairValue(w, category.price_per_kg_naira),
        confidence_score: analysis.confidence,
        toxicity_hazards: analysis.toxicity_hazards,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        contact_phone: sharePhone ? phone : undefined,
        auto_dispatch: coords != null,
      });
      setPosted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setBusy(false);
    }
  }

  if (posted) {
    return (
      <div className="card border-l-4 border-l-brand-500 bg-brand-50 text-center ring-brand-200 dark:bg-brand-950/50 dark:ring-brand-900">
        <svg className="mx-auto h-10 w-10 text-brand-600 dark:text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-2 font-semibold text-brand-800 dark:text-brand-200">{t("posted_success")}</p>
        <button onClick={onReset} className="btn-primary mt-4 w-full">
          {t("scan_again")}
        </button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <form onSubmit={submitAuth} className="card space-y-3">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t("sign_in_title")}</h4>
        {!otpSent && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={role === opt.value}
                onClick={() => setRole(opt.value)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  role === opt.value
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:ring-brand-900"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                }`}
              >
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">{opt.hint}</span>
              </button>
            ))}
          </div>
        )}
        <input
          className="input"
          type="tel"
          placeholder={t("your_phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />
        {otpSent && (
          <>
            {demoOtp && (
              <div className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                {t("demo_mode")}{" "}
                <strong className="tracking-widest">{demoOtp}</strong> — {t("demo_fallback_hint")}
              </div>
            )}
            <input
              className="input text-center text-lg tracking-[0.5em]"
              inputMode="numeric"
              maxLength={6}
              placeholder={t("enter_otp")}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </>
        )}
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : otpSent ? t("verify") : t("send_otp")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitWeight} className="card space-y-3">
      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t("post_pickup")}</h4>
      <input
        className="input text-lg"
        inputMode="decimal"
        placeholder={t("estimated_weight")}
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        required
      />
      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/60">
        <input
          type="checkbox"
          checked={sharePhone}
          onChange={(e) => setSharePhone(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span className="text-xs leading-snug text-gray-600 dark:text-gray-300">
          {t("share_phone_label")}
          {phone && <span className="block font-semibold text-gray-800 dark:text-gray-200">{phone}</span>}
        </span>
      </label>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? t("posting") : t("confirm_post")}
      </button>
    </form>
  );
}