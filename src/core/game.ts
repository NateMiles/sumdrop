import {
  COLS,
  ROWS,
  type Grid,
  type Rng,
  type Tile,
  type Wave,
  emptyGrid,
  findPops,
  landingRow,
  mulberry32,
  resolveCascade,
  spawnValue,
} from './rules';

/** Difficulty knobs, kept together so they are easy to tune. */
export const TUNING = {
  startRows: 2,
  /** Drops before the first new row rises. */
  firstRiseEvery: 12,
  /** The gap shrinks by one after each rise, down to this. */
  minRiseEvery: 6,
};

export interface DropOutcome {
  kind: 'dropped';
  placed: { tile: Tile; row: number; col: number };
  waves: Wave[];
  /** Present when a new row rose from the bottom after this drop. */
  rise?: { row: Tile[]; waves: Wave[] };
  gameOver: boolean;
  /** Points scored by this whole drop, including any rise cascade. */
  points: number;
}
export interface BlockedOutcome {
  kind: 'blocked';
}

/**
 * Game state machine. Synchronous: drop() applies the full result at once and
 * returns an outcome the UI replays as animation.
 */
export class Game {
  grid: Grid = emptyGrid();
  current = 1;
  next = 1;
  score = 0;
  longestChain = 0;
  drops = 0;
  riseEvery = TUNING.firstRiseEvery;
  untilRise = TUNING.firstRiseEvery;
  over = false;
  private rng: Rng;
  private nextId = 1;

  constructor(seed: number = (Math.random() * 2 ** 31) | 0) {
    this.rng = mulberry32(seed);
    this.reset();
  }

  reset(seed?: number): void {
    if (seed !== undefined) this.rng = mulberry32(seed);
    this.grid = emptyGrid();
    for (let r = ROWS - TUNING.startRows; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) this.grid[r][c] = this.makeTile();
    }
    // Reroll so the opening board is stable (nothing pops before the first move).
    for (let i = 0; i < 50; i++) {
      const pops = findPops(this.grid);
      if (!pops.length) break;
      for (const { r, c } of pops) this.grid[r][c] = this.makeTile();
    }
    this.current = spawnValue(this.rng);
    this.next = spawnValue(this.rng);
    this.score = 0;
    this.longestChain = 0;
    this.drops = 0;
    this.riseEvery = TUNING.firstRiseEvery;
    this.untilRise = TUNING.firstRiseEvery;
    this.over = false;
  }

  private makeTile(v = spawnValue(this.rng)): Tile {
    return { id: this.nextId++, v };
  }

  canDrop(col: number): boolean {
    return !this.over && landingRow(this.grid, col) >= 0;
  }

  drop(col: number): DropOutcome | BlockedOutcome {
    if (!this.canDrop(col)) return { kind: 'blocked' };
    const row = landingRow(this.grid, col);
    const tile = this.makeTile(this.current);
    this.grid[row][col] = tile;
    this.current = this.next;
    this.next = spawnValue(this.rng);
    this.drops++;

    const waves = resolveCascade(this.grid);
    let points = waves.reduce((s, w) => s + w.points, 0);
    let chain = waves.length;
    let rise: DropOutcome['rise'];
    let gameOver = false;

    this.untilRise--;
    if (this.untilRise <= 0) {
      if (this.grid[0].some(Boolean)) {
        gameOver = true;
      } else {
        const newRow = Array.from({ length: COLS }, () => this.makeTile());
        for (let r = 0; r < ROWS - 1; r++) this.grid[r] = this.grid[r + 1];
        this.grid[ROWS - 1] = newRow;
        const riseWaves = resolveCascade(this.grid);
        points += riseWaves.reduce((s, w) => s + w.points, 0);
        chain = Math.max(chain, riseWaves.length);
        rise = { row: newRow, waves: riseWaves };
        this.riseEvery = Math.max(TUNING.minRiseEvery, this.riseEvery - 1);
        this.untilRise = this.riseEvery;
      }
    }
    if (!gameOver && this.grid[0].every(Boolean)) gameOver = true;

    this.score += points;
    this.longestChain = Math.max(this.longestChain, chain);
    this.over = gameOver;
    return { kind: 'dropped', placed: { tile, row, col }, waves, rise, gameOver, points };
  }
}
