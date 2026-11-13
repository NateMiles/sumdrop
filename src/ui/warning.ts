export const WARNING_SHAKE_MS = 600;

/** Horizontal jiggle for bottom-row tiles: only during the first moments of the rise warning, fading out. */
export function warningWobble(warnAgeMs: number, t: number, col: number): number {
  if (!(warnAgeMs >= 0) || warnAgeMs >= WARNING_SHAKE_MS) return 0;
  const fade = 1 - warnAgeMs / WARNING_SHAKE_MS;
  return Math.sin(t / 30 + col) * 3 * fade;
}
