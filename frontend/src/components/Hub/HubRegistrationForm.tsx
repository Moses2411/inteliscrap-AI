import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { registerHub } from "../../services/hubs";
import { syncRoleFromServer } from "../../services/auth";

interface Props {
  /** Called after the hub is registered and the role has been synced. */
  onRegistered?: () => void;
  submitLabel?: string;
}

/**
 * The recycling-hub sign-up form. Shared by the login flow (a hub registers
 * immediately after verifying their phone) and the hub dashboard fallback.
 */
export default function HubRegistrationForm({ onRegistered, submitLabel = "Register hub" }: Props) {
  const [form, setForm] = useState({ name: "", address_text: "", city: "Zaria", contact_phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Hub name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await registerHub({
        name: form.name.trim(),
        address_text: form.address_text.trim() || undefined,
        city: form.city.trim() || "Zaria",
        contact_phone: form.contact_phone.trim() || undefined,
      });
      // The backend promotes the account to the recycling_hub role.
      await syncRoleFromServer();
      onRegistered?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register hub");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="hub-name">Hub name</label>
        <input
          id="hub-name"
          type="text"
          placeholder="e.g. GreenCycle Hub"
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="hub-address">Address (optional)</label>
        <input
          id="hub-address"
          type="text"
          placeholder="e.g. Along Kano Road, Samaru"
          className="input"
          value={form.address_text}
          onChange={(e) => setForm({ ...form, address_text: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="hub-city">City</label>
        <input
          id="hub-city"
          type="text"
          className="input"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="hub-phone">Contact phone (optional)</label>
        <input
          id="hub-phone"
          type="tel"
          placeholder="+23480xxxxxxxx"
          className="input"
          value={form.contact_phone}
          onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
        />
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
      <Button fullWidth type="submit" loading={submitting} className="pt-2">
        {submitLabel}
      </Button>
    </form>
  );
}
