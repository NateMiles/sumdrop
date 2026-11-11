import { describe, expect, it } from 'vitest';
import {
  COLS,
  ROWS,
  type Grid,
  applyGravity,
  emptyGrid,
  findPops,
  landingRow,
  mulberry32,
  neighborSum,
  previewDrop,
  resolveCascade,
  spawnValue,
  PREVIEW_ID,
} from '../src/core/rules';
import { Game } from '../src/core/game';

let id = 100;
/** Builds a grid from bottom-aligned rows of digits; '.' is empty. */
function grid(rows: string[]): Grid {
  const g = emptyGrid();
  const top = ROWS - rows.length;
  rows.forEach((line, i) => {
    [...line].forEach((ch, c) => {
      if (ch !== '.') g[top + i][c] = { id: id++, v: Number(ch) };
    });
  });
  return g;
}
const vals = (g: Grid) => g.map((row) => row.map((t) => (t ? String(t.v) : '.')).join(''));

describe('neighborSum', () => {
  it('adds orthogonal neighbors only', () => {
    const g = grid(['121...', '313...', '121...']);
    expect(neighborSum(g, ROWS - 2, 1)).toBe(2 + 2 + 3 + 3);
  });
  it('treats edges and empty cells as zero', () => {
    const g = grid(['4.....']);
    expect(neighborSum(g, ROWS - 1, 0)).toBe(0);
  });
});

describe('findPops', () => {
  it('pops a tile filled exactly to its value', () => {
    const g = grid(['3.....', '21....']);
    // bottom-left 2: neighbors 3 (above) + 1 (right) = 4, not 2. The 1: neighbor 2 → overfull.
    // the 3: neighbor 2 below → 2, not 3.
    expect(findPops(g)).toEqual([]);
    const g2 = grid(['2.....', '11....']);
    // top 2: below is 1 → 1. bottom-left 1: 2 + 1 = 3. bottom-right 1: 1 → pops.
    // splash: bottom-left 1 is same value and touching, so it pops too.
    expect(findPops(g2).map((p) => [p.r, p.c])).toEqual([
      [ROWS - 1, 0],
      [ROWS - 1, 1],
    ]);
  });
  it('a pair of equal singles pops together', () => {
    const g = grid(['33....']);
    expect(findPops(g)).toHaveLength(2);
  });
  it('splashes through a connected same-value group, but not into other values', () => {
    // The end 1 has fill 1 and pops; the other two 1s are not full but splash with it. The 2 stays.
    const g = grid(['1112..']);
    expect(findPops(g).map((p) => p.c)).toEqual([0, 1, 2]);
  });
});

describe('applyGravity', () => {
  it('compacts columns and reports falls', () => {
    const g = grid(['1.....', '......', '2.....']);
    const falls = applyGravity(g);
    expect(vals(g).slice(-2)).toEqual(['1.....', '2.....']);
    expect(falls).toHaveLength(1);
    expect(falls[0]).toMatchObject({ c: 0, fromRow: ROWS - 3, toRow: ROWS - 2 });
  });
});

describe('landingRow', () => {
  it('finds the lowest empty row and -1 for a full column', () => {
    expect(landingRow(emptyGrid(), 0)).toBe(ROWS - 1);
    const full = emptyGrid();
    for (let r = 0; r < ROWS; r++) full[r][2] = { id: id++, v: 6 };
    expect(landingRow(full, 2)).toBe(-1);
  });
});

describe('resolveCascade', () => {
  it('chains: a pop lets a tile fall into an exact fill', () => {
    // Wave 1: the bottom-right 1 is full (left neighbor 1) and splashes the other 1.
    // Column 1 falls, the 2 lands next to the bottom-left 2, and they pop as wave 2.
    const g = grid(['.4....', '.2....', '211...']);
    const waves = resolveCascade(g);
    expect(waves.map((w) => w.chain)).toEqual([1, 2]);
    expect(waves[0].popped.map((p) => p.tile.v)).toEqual([1, 1]);
    expect(waves[1].popped.map((p) => p.tile.v)).toEqual([2, 2]);
    expect(waves[1].points).toBe((2 + 2) * 10 * 2);
    expect(vals(g)[ROWS - 1]).toBe('.4....');
    expect(findPops(g)).toEqual([]);
  });
  it('scores dots x 10 x chain', () => {
    const g = grid(['33....']);
    const [w] = resolveCascade(g);
    expect(w.points).toBe(3 * 10 * 1 * 2);
  });
});

describe('previewDrop', () => {
  it('predicts pops without changing the board', () => {
    const g = grid(['3.....']);
    const before = vals(g);
    const p = previewDrop(g, 1, 3)!;
    expect(p.row).toBe(ROWS - 1);
    expect(p.waves).toBe(1);
    expect(p.waveOf.get(PREVIEW_ID)).toBe(0);
    expect(p.points).toBe(60);
    expect(vals(g)).toEqual(before);
  });
  it('returns null for a full column', () => {
    const g = emptyGrid();
    for (let r = 0; r < ROWS; r++) g[r][0] = { id: id++, v: 6 };
    expect(previewDrop(g, 0, 1)).toBeNull();
  });
});

describe('spawnValue', () => {
  it('only produces 1..6', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = spawnValue(rng);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe('Game', () => {
  it('starts with a stable two-row board', () => {
    const game = new Game(42);
    expect(game.grid[ROWS - 1].every(Boolean)).toBe(true);
    expect(game.grid[ROWS - 2].every(Boolean)).toBe(true);
    expect(game.grid[ROWS - 3].some(Boolean)).toBe(false);
    expect(findPops(game.grid)).toEqual([]);
  });
  it('is deterministic for a seed', () => {
    const a = new Game(7);
    const b = new Game(7);
    for (let i = 0; i < 20; i++) {
      a.drop(i % COLS);
      b.drop(i % COLS);
    }
    expect(vals(a.grid)).toEqual(vals(b.grid));
    expect(a.score).toBe(b.score);
  });
  it('matches its own preview', () => {
    const game = new Game(3);
    for (let i = 0; i < 30 && !game.over; i++) {
      const col = i % COLS;
      if (!game.canDrop(col)) continue;
      const willRise = game.untilRise === 1;
      const p = previewDrop(game.grid, col, game.current)!;
      const out = game.drop(col);
      if (out.kind !== 'dropped' || willRise) continue;
      expect(out.waves.length).toBe(p.waves);
      expect(out.points).toBe(p.points);
    }
  });
  it('raises a new row on schedule and eventually ends', () => {
    const game = new Game(11);
    let rises = 0;
    for (let i = 0; i < 2000 && !game.over; i++) {
      const out = game.drop(0); // always the same column: worst play
      if (out.kind === 'blocked') {
        // column full; try others
        const col = [...Array(COLS).keys()].find((c) => game.canDrop(c));
        if (col === undefined) break;
        const o2 = game.drop(col);
        if (o2.kind === 'dropped' && o2.rise) rises++;
      } else if (out.rise) rises++;
    }
    expect(rises).toBeGreaterThan(0);
    expect(game.over).toBe(true);
  });
  it('refuses drops into a full column', () => {
    const game = new Game(5);
    for (let r = 0; r < ROWS; r++) game.grid[r][0] = { id: 9000 + r, v: 6 };
    expect(game.drop(0)).toEqual({ kind: 'blocked' });
  });
});
