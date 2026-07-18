import type { SyncResponse } from "../types";
import { cachePrices, getUnsyncedScans, markScanAsSynced } from "./db";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function syncScans(userId: string): Promise<SyncResponse | null> {
  if (!navigator.onLine) return null;

  const unsynced = await getUnsyncedScans();
  if (unsynced.length === 0) return null;

  const payload = {
    user_id: userId,
    local_scans: unsynced.map((s) => ({
      id: s.id,
      material_class: s.material_class,
      sub_grade: s.sub_grade ?? null,
      weight_est_kg: s.weight_est_kg ?? null,
      estimated_naira_value: s.estimated_naira_value,
      confidence_score: s.confidence_score,
      toxicity_hazards: s.toxicity_hazards ?? null,
      safety_instructions: s.safety_instructions ?? null,
      captured_at: s.captured_at,
      is_deleted: s.is_deleted,
    })),
  };

  const response = await fetch(`${API_BASE}/api/v1/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }

  const result: SyncResponse = await response.json();

  for (const id of result.synced_ids) {
    await markScanAsSynced(id);
  }

  if (result.latest_prices.length > 0) {
    await cachePrices(result.latest_prices);
  }

  return result;
}

export async function registerUser(phoneNumber: string, fullName?: string): Promise<{ id: string }> {
  const response = await fetch(`${API_BASE}/api/v1/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber, full_name: fullName }),
  });

  if (!response.ok) {
    throw new Error(`Registration failed: ${response.statusText}`);
  }

  return response.json();
}
