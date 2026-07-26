/** Compact star count for nav chips (e.g. `1.2k`). */
export function formatStars(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  return String(n);
}
