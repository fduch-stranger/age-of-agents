/** Context-window fill percentage, 0..100 (rounded, clamped). Window is provided externally. */
export function contextPct(tokens: number, windowSize: number): number {
  if (!(windowSize > 0)) return 0;
  return Math.min(100, Math.round((tokens / windowSize) * 100));
}

/** Fill color by percentage: green <=10, yellow <=50, toward red up to 100. */
export function contextColor(pct: number): string {
  if (pct <= 10) return '#5dcaa5';
  if (pct <= 50) return '#f0d76e';
  if (pct <= 75) return '#f0b56e';
  if (pct <= 90) return '#ef7a6a';
  return '#e24b4a';
}
