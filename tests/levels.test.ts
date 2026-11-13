import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { goalMet, goalProgress, levelConfig, levelResult, LEFTOVER_BONUS } from '../src/core/level';
import { LEVELS, levelById, nextLevel } from '../src/core/levels';
import { findPops } from '../src/core/rules';

const play = (id: string, cols: number[], seed = 1) => {
  const def = levelById(id)!;
  const g = new Game(seed, levelConfig(def));
  for (const c of cols) g.drop(c);
  return { def, g };
};

describe('level definitions', () => {
  it('have unique ids and sane numbers', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const l of LEVELS) {
      expect(l.drops).toBeGreaterThan(0);
      expect(l.stars[1]).toBeGreaterThanOrEqual(l.stars[0]);
    }
  });

  it.each(LEVELS.map((l) => [l.id, l] as const))('%s starts stable and the right size', (_, def) => {
    const g = new Game(1, levelConfig(def));
    expect(findPops(g.grid)).toEqual([]);
    expect(g.grid.length).toBe(def.rows ?? 8);
    for (const line of def.board ?? []) expect(line.length).toBe(def.cols ?? 6);
    // Boards must already be settled: no cat floating over an empty cell.
    for (let r = 0; r < g.rows - 1; r++) for (let c = 0; c < g.cols; c++) if (g.grid[r][c]) expect(g.grid[r + 1][c]).not.toBeNull();
  });

  it('chains to the next level', () => {
    expect(nextLevel('t1')?.id).toBe('t2');
    expect(nextLevel(LEVELS[LEVELS.length - 1].id)).toBeUndefined();
  });
});

describe('tutorial solutions', () => {
  it('t1: two kitten pairs clear the board', () => {
    const { def, g } = play('t1', [1, 2]);
    expect(g.won).toBe(true);
    expect(g.over).toBe(true);
    expect(levelResult(def, g).stars).toBe(3);
  });

  it('t2: ginger between kittens, then a kitten splash', () => {
    const { g } = play('t2', [1, 1]);
    expect(g.won).toBe(true);
    expect(g.sleptBySize[2]).toBe(1);
    expect(g.sleptBySize[1]).toBe(3);
  });

  it('t3: the blue next to the blues makes a ×2 chain', () => {
    const { g } = play('t3', [1]);
    expect(g.longestChain).toBe(2);
    expect(g.won).toBe(true);
  });

  it('t1: a wasted drop is still recoverable, running out of drops loses', () => {
    const { g } = play('t1', [0, 0, 0]);
    expect(g.won).toBe(false);
    expect(g.over).toBe(false);
    g.drop(0);
    expect(g.over).toBe(true);
    expect(g.endReason).toBe('outOfDrops');
  });
});

describe('goals and results', () => {
  it('winning on the very last drop counts as a win', () => {
    const def = { ...levelById('t1')!, drops: 2 };
    const g = new Game(1, levelConfig(def));
    g.drop(1);
    g.drop(2);
    expect(g.endReason).toBe('won');
    expect(levelResult(def, g).bonus).toBe(0);
  });

  it('adds the leftover-drop bonus and maps scores to stars', () => {
    const def = { ...levelById('t1')!, stars: [100, 150] as [number, number] };
    const g = new Game(1, levelConfig(def));
    g.drop(1);
    g.drop(2);
    const r = levelResult(def, g);
    expect(r.bonus).toBe(2 * LEFTOVER_BONUS);
    expect(r.score).toBe(g.score + r.bonus);
    expect(r.stars).toBe(r.score >= 150 ? 3 : r.score >= 100 ? 2 : 1);
  });

  it('counts sleeping cats by size', () => {
    const g = new Game(1, levelConfig(levelById('t2')!));
    g.drop(1);
    expect(goalMet({ kind: 'sleep', count: 1, size: 2 }, g)).toBe(true);
    expect(goalMet({ kind: 'sleep', count: 1, size: 1 }, g)).toBe(false);
    expect(goalProgress({ kind: 'clear' }, g)).toEqual({ have: 1, need: 3 });
  });

  it('levels without rising never add rows', () => {
    const g = new Game(1, levelConfig(levelById('g1')!));
    const before = g.grid.flat().filter(Boolean).length;
    for (let i = 0; i < 15 && !g.over; i++) g.drop(i % 6);
    expect(g.rising).toBe(false);
    expect(g.grid.flat().filter(Boolean).length).toBeLessThanOrEqual(before + 15);
  });

  it('the same seed replays a level identically', () => {
    const a = play('g6', [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4], 42).g;
    const b = play('g6', [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4], 42).g;
    expect(a.grid.map((r) => r.map((t) => t?.v ?? 0))).toEqual(b.grid.map((r) => r.map((t) => t?.v ?? 0)));
  });
});

describe('swap and chain rewards', () => {
  it('swap trades the cat in hand with the next one, and the queue continues', () => {
    const g = new Game(1, { queue: [1, 2, 3] });
    expect([g.current, g.next]).toEqual([1, 2]);
    expect(g.swap()).toBe(true);
    expect([g.current, g.next]).toEqual([2, 1]);
    g.drop(0);
    expect([g.current, g.next]).toEqual([1, 3]);
    expect(g.swaps).toBe(1);
  });

  it('chain steps double the points: x1, x2, x4, x8', async () => {
    const { chainMultiplier } = await import('../src/core/rules');
    expect([1, 2, 3, 4].map(chainMultiplier)).toEqual([1, 2, 4, 8]);
  });
});

describe('world words', () => {
  it('goal text uses the world theme words, neutral by default', async () => {
    const { goalText } = await import('../src/core/level');
    const cats = { pieces: 'cats', sizeNames: ['', 'kittens', 'gingers'], clearVerb: 'Tuck in' };
    expect(goalText({ kind: 'sleep', count: 5, size: 2 }, cats)).toBe('Tuck in 5 gingers');
    expect(goalText({ kind: 'clear' }, cats)).toBe('Tuck in all the cats');
    expect(goalText({ kind: 'sleep', count: 3 })).toBe('Clear 3 pieces');
  });
});
