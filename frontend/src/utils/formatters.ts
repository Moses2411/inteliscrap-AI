export function formatNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

export function generateScanId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `scan_${ts}_${rand}`;
}
