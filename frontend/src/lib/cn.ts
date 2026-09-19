/** Minimal classnames joiner — keeps the PWA dependency-free. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}