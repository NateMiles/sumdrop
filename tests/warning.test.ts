import { describe, expect, it } from 'vitest';
import { WARNING_SHAKE_MS, warningWobble } from '../src/ui/warning';

describe('warningWobble', () => {
  it('shakes only briefly when the rise warning starts', () => {
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(warningWobble(10, i * 7, 0))));
    expect(peak).toBeGreaterThan(1);
  });
  it('stops completely after the shake window, however long the warning lasts', () => {
    for (const age of [WARNING_SHAKE_MS, 1000, 60_000]) {
      for (let t = 0; t < 500; t += 13) expect(warningWobble(age, t, 3)).toBe(0);
    }
  });
  it('is still when there is no warning', () => {
    expect(warningWobble(Infinity, 123, 1)).toBe(0);
    expect(warningWobble(-1, 123, 1)).toBe(0);
  });
});
