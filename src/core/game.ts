import {
  COLS,
  MAX_VALUE,
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

/** Difficulty knobs for Endless mode, kept together so they are easy to tune. */
export const TUNING = {
  startRows: 2,
  /** Drops before the first new row rises. */
  firstRiseEvery: 12,
  /** The gap shrinks by one after each rise, down to this. */
  minRiseEvery: 6,
};

/** How a game is set up. Endless mode uses the defaults; levels fill in the rest. */
export interface GameConfig {
  rows?: number;
  cols?: number;
  /**
   * Hand-made starting board, bottom-aligned: the last string is the bottom row.
   * '.' is empty, '1' to '6' is a cat of that size. Without it, startRows random rows.
   */
  board?: string[];
  startRows?: number;
  /** Cats handed out first, in this order. Random cats follow once it runs out. */
  queue?: number[];
  /** Largest cat that appears at random (in drops and rising rows). */
  maxValue?: number;
  /** Rising rows: first gap and the smallest gap. null turns rising off. */
  rise?: { first: number; min: number } | null;
  /** Drop limit. Undefined means unlimited (Endless). */
  maxDrops?: number;
  /** Checked after every drop. Returning true ends the game as a win. */
  goalMet?: (game: Game) => boolean;
}

export interface DropOutcome {
  kind: 'dropped';
  placed: { tile: Tile; row: number; col: number };
  waves: Wave[];
  /** Present when a new row rose from the bottom after this drop. */
  rise?: { row: Tile[]; waves: Wave[] };
  gameOver: boolean;
  /** True when this drop met the level goal. */
  won: boolean;
  /** Points scored by this whole drop, including any rise cascade. */
  points: number;
}
export interface BlockedOutcome {
  kind: 'blocked';
}

export type EndReason = 'won' | 'full' | 'outOfDrops';

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
  swaps = 0;
  /** Cats put to sleep, in total and by size (index = size). */
  slept = 0;
  sleptBySize: number[] = Array(MAX_VALUE + 1).fill(0);
  riseEvery = TUNING.firstRiseEvery;
  untilRise = TUNING.firstRiseEvery;
  over = false;
  won = false;
  endReason: EndReason | null = null;
  config: GameConfig = {};
  private rng: Rng;
  private queue: number[] = [];
  private nextId = 1;

  constructor(seed: number = (Math.random() * 2 ** 31) | 0, config: GameConfig = {}) {
    this.rng = mulberry32(seed);
    this.config = config;
    this.reset();
  }

  get rows(): number {
    return this.config.rows ?? ROWS;
  }
  get cols(): number {
    return this.config.cols ?? COLS;
  }
  get rising(): boolean {
    return this.config.rise !== null;
  }
  get dropsLeft(): number {
    return this.config.maxDrops === undefined ? Infinity : Math.max(0, this.config.maxDrops - this.drops);
  }

  /** Switches to a new setup (a level, or Endless with {}), then resets. */
  load(config: GameConfig, seed?: number): void {
    this.config = config;
    this.reset(seed);
  }

  reset(seed?: number): void {
    if (seed !== undefined) this.rng = mulberry32(seed);
    const cfg = this.config;
    this.grid = emptyGrid(this.rows, this.cols);
    if (cfg.board) {
      const top = this.rows - cfg.board.length;
      cfg.board.forEach((line, i) => {
        for (let c = 0; c < this.cols; c++) {
          const ch = line[c];
          if (ch && ch >= '1' && ch <= String(MAX_VALUE)) this.grid[top + i][c] = this.makeTile(Number(ch));
        }
      });
    } else {
      // Uneven column heights (1 to startRows + 1), so cats start with open sides and
      // visible needs instead of a solid wall of over-warm cats.
      const startRows = cfg.startRows ?? TUNING.startRows;
      if (startRows > 0) {
        for (let c = 0; c < this.cols; c++) {
          const h = 1 + Math.floor(this.rng() * (startRows + 1));
          for (let k = 0; k < h; k++) this.grid[this.rows - 1 - k][c] = this.makeTile();
        }
      }
      // Reroll so the opening board is stable (nothing pops before the first move).
      for (let i = 0; i < 50; i++) {
        const pops = findPops(this.grid);
        if (!pops.length) break;
        for (const { r, c } of pops) this.grid[r][c] = this.makeTile();
      }
    }
    this.queue = [...(cfg.queue ?? [])];
    this.current = this.takeNext();
    this.next = this.takeNext();
    this.score = 0;
    this.longestChain = 0;
    this.drops = 0;
    this.swaps = 0;
    this.slept = 0;
    this.sleptBySize = Array(MAX_VALUE + 1).fill(0);
    const rise = cfg.rise ?? { first: TUNING.firstRiseEvery, min: TUNING.minRiseEvery };
    this.riseEvery = rise.first;
    this.untilRise = rise.first;
    this.over = false;
    this.won = false;
    this.endReason = null;
  }

  private takeNext(): number {
    return this.queue.length ? this.queue.shift()! : spawnValue(this.rng, this.config.maxValue);
  }

  private makeTile(v = spawnValue(this.rng, this.config.maxValue)): Tile {
    return { id: this.nextId++, v };
  }

  /** Swaps the cat in hand with the next one. Free and unlimited: it is a planning tool. */
  swap(): boolean {
    if (this.over) return false;
    [this.current, this.next] = [this.next, this.current];
    this.swaps++;
    return true;
  }

  canDrop(col: number): boolean {
    return !this.over && landingRow(this.grid, col) >= 0;
  }

  private count(waves: Wave[]): void {
    for (const w of waves) {
      for (const p of w.popped) {
        this.slept++;
        this.sleptBySize[p.tile.v]++;
      }
    }
  }

  drop(col: number): DropOutcome | BlockedOutcome {
    if (!this.canDrop(col)) return { kind: 'blocked' };
    const row = landingRow(this.grid, col);
    const tile = this.makeTile(this.current);
    this.grid[row][col] = tile;
    this.current = this.next;
    this.next = this.takeNext();
    this.drops++;

    const waves = resolveCascade(this.grid);
    this.count(waves);
    let points = waves.reduce((s, w) => s + w.points, 0);
    let chain = waves.length;
    let rise: DropOutcome['rise'];
    let full = false;

    const riseCfg = this.config.rise ?? { first: TUNING.firstRiseEvery, min: TUNING.minRiseEvery };
    if (this.rising) {
      this.untilRise--;
      if (this.untilRise <= 0) {
        if (this.grid[0].some(Boolean)) {
          full = true;
        } else {
          const newRow = Array.from({ length: this.cols }, () => this.makeTile());
          for (let r = 0; r < this.rows - 1; r++) this.grid[r] = this.grid[r + 1];
          this.grid[this.rows - 1] = newRow;
          const riseWaves = resolveCascade(this.grid);
          this.count(riseWaves);
          points += riseWaves.reduce((s, w) => s + w.points, 0);
          chain = Math.max(chain, riseWaves.length);
          rise = { row: newRow, waves: riseWaves };
          this.riseEvery = Math.max(riseCfg.min, this.riseEvery - 1);
          this.untilRise = this.riseEvery;
        }
      }
    }
    if (!full && this.grid[0].every(Boolean)) full = true;

    this.score += points;
    this.longestChain = Math.max(this.longestChain, chain);
    // The goal is checked first, so meeting it on the last drop still wins.
    const won = this.config.goalMet?.(this) ?? false;
    if (won) this.endReason = 'won';
    else if (full) this.endReason = 'full';
    else if (this.dropsLeft <= 0) this.endReason = 'outOfDrops';
    this.won = won;
    this.over = this.endReason !== null;
    return { kind: 'dropped', placed: { tile, row, col }, waves, rise, gameOver: this.over, won, points };
  }
}
