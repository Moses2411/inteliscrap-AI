export function formatNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Compact naira for KPI tiles: ₦1.2M / ₦340K / ₦5,600 */
export function formatCompactNaira(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `₦${(value / 1_000).toFixed(abs >= 100_000 ? 1 : 0)}K`;
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function formatKg(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1)} t`;
  return `${value.toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

/** "just now", "12m ago", "3h ago", "2d ago", else a date */
export function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function generateScanId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `scan_${ts}_${rand}`;
}

/** Readable display form for a saved phone: "+2349160634282" → "0916 063 4282". */
export function formatPhoneDisplay(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("234") && d.length > 10) d = `0${d.slice(3)}`;
  const m = d.match(/^(\d{4})(\d{3})(\d{4})/);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return d || null;
}