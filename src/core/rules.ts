/**
 * Sum Drop core rules. Pure functions only: no DOM, no timers, no randomness
 * except through an injected Rng. Everything here is unit tested.
 *
 * Rule summary:
 * - A tile's "fill" is the sum of the dots on its orthogonal neighbors.
 * - When fill equals the tile's own value exactly, the tile pops.
 * - Splash: any same-value tiles connected to a popping tile pop with it.
 * - After pops, tiles fall (gravity) and the board is re-checked. Each
 *   further round of pops is one more step in the chain.
 *
 * Special tiles:
 * - Stone: gives nothing and never counts down. It crumbles when a piece next to it breaks.
 * - Ice: a frozen piece gives as usual but cannot break. A piece breaking next to it
 *   melts one layer; once free it is a normal piece again.
 * - Bomb: a normal piece that, when it breaks, also breaks everything around it
 *   (all 8 cells, stones and frozen pieces included). Bombs set off bombs.
 */

/** Default (Endless) board size. Levels may use other sizes; rules read the size from the grid. */
export const COLS = 6;
export const ROWS = 8;
export const MAX_VALUE = 6;
export const POINTS_PER_DOT = 10;

export type TileKind = 'stone' | 'bomb';
export interface Tile {
  id: number;
  /** Size: what it needs and what it gives. 0 for a stone. */
  v: number;
  kind?: TileKind;
  /** Layers of ice left. A frozen tile cannot break. */
  ice?: number;
}

export const isStone = (t: Tile | null | undefined): boolean => t?.kind === 'stone';
/** Whether a tile can break by counting down (not a stone, not frozen). */
export const canCount = (t: Tile | null | undefined): t is Tile => !!t && t.kind !== 'stone' && !t.ice;

/** Points for breaking a stone and for melting one layer of ice, before the chain multiplier. */
export const STONE_POINTS = 20;
export const ICE_POINTS = 10;
/** grid[row][col], row 0 is the top. */
export type Grid = (Tile | null)[][];
export interface Cell {
  r: number;
  c: number;
}
export type Rng = () => number;

const DIRS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Small deterministic PRNG so games and tests can be replayed from a seed. */
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted toward small values so exact fills happen often enough. */
export const SPAWN_WEIGHTS: readonly number[] = [3, 5, 5, 4, 3, 2];

/** Random cat size. maxValue limits the sizes in play (early levels use only small cats). */
export function spawnValue(rng: Rng, maxValue = MAX_VALUE): number {
  const weights = SPAWN_WEIGHTS.slice(0, maxValue);
  const total = weights.reduce((a, b) => a + b, 0);
  let n = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    n -= weights[i];
    if (n < 0) return i + 1;
  }
  return weights.length;
}

export function emptyGrid(rows = ROWS, cols = COLS): Grid {
  return Array.from({ length: rows }, () => Array<Tile | null>(cols).fill(null));
}

export const rowsOf = (g: Grid): number => g.length;
export const colsOf = (g: Grid): number => g[0]?.length ?? 0;

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => row.map((t) => (t ? { ...t } : null)));
}

export function inBounds(g: Grid, r: number, c: number): boolean {
  return r >= 0 && r < g.length && c >= 0 && c < colsOf(g);
}

export function neighborSum(g: Grid, r: number, c: number): number {
  let s = 0;
  for (const [dr, dc] of DIRS) {
    const r2 = r + dr;
    const c2 = c + dc;
    if (inBounds(g, r2, c2)) s += g[r2][c2]?.v ?? 0;
  }
  return s;
}

/** 0..1 while filling, exactly 1 when about to pop, >1 when overflowing. */
export function fillRatio(g: Grid, r: number, c: number): number {
  const t = g[r][c];
  return t ? neighborSum(g, r, c) / t.v : 0;
}

/** Tiles that pop right now: exactly-full tiles plus their same-value connected groups, then blasts. */
export function findPops(g: Grid): Cell[] {
  const rows = rowsOf(g);
  const cols = colsOf(g);
  const seen = new Set<number>();
  const queue: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = g[r][c];
      if (canCount(t) && neighborSum(g, r, c) === t.v) {
        seen.add(r * cols + c);
        queue.push({ r, c });
      }
    }
  }
  const out: Cell[] = [];
  while (queue.length) {
    const cell = queue.pop()!;
    out.push(cell);
    const v = g[cell.r][cell.c]!.v;
    for (const [dr, dc] of DIRS) {
      const r2 = cell.r + dr;
      const c2 = cell.c + dc;
      if (!inBounds(g, r2, c2) || seen.has(r2 * cols + c2)) continue;
      const t2 = g[r2][c2];
      if (!canCount(t2) || t2.v !== v) continue;
      seen.add(r2 * cols + c2);
      queue.push({ r: r2, c: c2 });
    }
  }
  return expandBlast(g, out);
}

/**
 * Everything that breaks along with `seeds`: bombs take all 8 cells around them
 * (setting off other bombs), and stones next to a breaking piece crumble.
 */
export function expandBlast(g: Grid, seeds: Cell[]): Cell[] {
  const cols = colsOf(g);
  const key = (r: number, c: number) => r * cols + c;
  const hit = new Map<number, Cell>();
  const queue = [...seeds];
  for (const s of seeds) hit.set(key(s.r, s.c), s);
  while (queue.length) {
    const { r, c } = queue.pop()!;
    if (g[r][c]?.kind !== 'bomb') continue;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (!inBounds(g, r2, c2) || !g[r2][c2] || hit.has(key(r2, c2))) continue;
        const cell = { r: r2, c: c2 };
        hit.set(key(r2, c2), cell);
        queue.push(cell);
      }
    }
  }
  for (const { r, c } of [...hit.values()]) {
    if (isStone(g[r][c])) continue;
    for (const [dr, dc] of DIRS) {
      const r2 = r + dr;
      const c2 = c + dc;
      if (inBounds(g, r2, c2) && isStone(g[r2][c2]) && !hit.has(key(r2, c2))) hit.set(key(r2, c2), { r: r2, c: c2 });
    }
  }
  return [...hit.values()].sort((a, b) => a.r - b.r || a.c - b.c);
}

/** Frozen tiles next to a breaking (non-stone) tile, which lose a layer of ice. */
function findThaws(g: Grid, popped: Cell[]): Cell[] {
  const cols = colsOf(g);
  const gone = new Set(popped.map((p) => p.r * cols + p.c));
  const out = new Map<number, Cell>();
  for (const { r, c } of popped) {
    if (isStone(g[r][c])) continue;
    for (const [dr, dc] of DIRS) {
      const r2 = r + dr;
      const c2 = c + dc;
      const k = r2 * cols + c2;
      if (inBounds(g, r2, c2) && g[r2][c2]?.ice && !gone.has(k)) out.set(k, { r: r2, c: c2 });
    }
  }
  return [...out.values()];
}

export interface Fall {
  id: number;
  c: number;
  fromRow: number;
  toRow: number;
}

/** Compacts every column downward. Mutates g and returns the moves made. */
export function applyGravity(g: Grid): Fall[] {
  const falls: Fall[] = [];
  const rows = rowsOf(g);
  for (let c = 0; c < colsOf(g); c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const t = g[r][c];
      if (!t) continue;
      if (r !== write) {
        g[write][c] = t;
        g[r][c] = null;
        falls.push({ id: t.id, c, fromRow: r, toRow: write });
      }
      write--;
    }
  }
  return falls;
}

/** Row a tile dropped into column c lands on, or -1 if the column is full. */
export function landingRow(g: Grid, c: number): number {
  if (c < 0 || c >= colsOf(g)) return -1;
  for (let r = g.length - 1; r >= 0; r--) if (!g[r][c]) return r;
  return -1;
}

export interface PoppedTile extends Cell {
  tile: Tile;
}
export interface Wave {
  /** 1 for the first round of pops, 2 for the next, and so on. */
  chain: number;
  popped: PoppedTile[];
  /** Frozen tiles that lost a layer of ice (before the falls). */
  thawed: PoppedTile[];
  points: number;
  falls: Fall[];
}

/** Point multiplier for a chain step: ×1, ×2, ×4, ×8... so setting up chains pays off. */
export function chainMultiplier(chain: number): number {
  return 2 ** Math.min(chain - 1, 6);
}

export function wavePoints(popped: PoppedTile[], chain: number, thawed = 0): number {
  const base = popped.reduce((sum, p) => sum + (isStone(p.tile) ? STONE_POINTS : p.tile.v * POINTS_PER_DOT), 0) + thawed * ICE_POINTS;
  return base * chainMultiplier(chain);
}

/** Breaks `cells` as one wave: melts ice next to them, removes them, applies gravity. Mutates g. */
export function breakWave(g: Grid, cells: Cell[], chain: number): Wave {
  const popped = cells.map(({ r, c }) => ({ r, c, tile: g[r][c]! }));
  const thawed = findThaws(g, cells).map(({ r, c }) => {
    const tile = g[r][c]!;
    tile.ice = Math.max(0, (tile.ice ?? 0) - 1);
    return { r, c, tile: { ...tile } };
  });
  for (const { r, c } of cells) g[r][c] = null;
  const falls = applyGravity(g);
  return { chain, popped, thawed, points: wavePoints(popped, chain, thawed.length), falls };
}

/** Runs pops and gravity until the board is stable. Mutates g. */
export function resolveCascade(g: Grid, startChain = 1): Wave[] {
  const waves: Wave[] = [];
  for (let chain = startChain; ; chain++) {
    const cells = findPops(g);
    if (!cells.length) break;
    waves.push(breakWave(g, cells, chain));
  }
  return waves;
}

/** Smashes the tile at (r, c) (a hammer), with its blast, then runs the cascade. Mutates g. */
export function smashCell(g: Grid, r: number, c: number): Wave[] {
  if (!g[r]?.[c]) return [];
  const first = breakWave(g, expandBlast(g, [{ r, c }]), 1);
  return [first, ...resolveCascade(g, 2)];
}

export interface DropPreview {
  row: number;
  col: number;
  /** waveIndex by tile id; the dropped tile uses id -1. */
  waveOf: Map<number, number>;
  waves: number;
  points: number;
  /** Fill ratio the dropped tile would have where it lands. */
  landingFill: number;
  /** Tiles that slide down after each wave, by wave index. */
  fallsByWave: Fall[][];
}

export const PREVIEW_ID = -1;

/** What would happen if a tile of value v (a bomb if `bomb`) were dropped in column col. No mutation. */
export function previewDrop(g: Grid, col: number, v: number, bomb = false): DropPreview | null {
  const row = landingRow(g, col);
  if (row < 0) return null;
  const sim = cloneGrid(g);
  sim[row][col] = { id: PREVIEW_ID, v, ...(bomb ? { kind: 'bomb' as const } : {}) };
  const landingFill = neighborSum(sim, row, col) / v;
  const waves = resolveCascade(sim);
  const waveOf = new Map<number, number>();
  waves.forEach((w, i) => w.popped.forEach((p) => waveOf.set(p.tile.id, i)));
  return {
    row,
    col,
    waveOf,
    waves: waves.length,
    points: waves.reduce((s, w) => s + w.points, 0),
    landingFill,
    fallsByWave: waves.map((w) => w.falls),
  };
}
