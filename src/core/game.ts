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
  isStone,
  resolveCascade,
  smashCell,
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
   * '.' is empty, '1' to '6' is a piece of that size, '#' a stone, 'a' to 'f' a frozen
   * piece of size 1 to 6 (one layer of ice), 'A' to 'F' a bomb of size 1 to 6.
   * Without it, startRows random rows.
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
  /** Chance (0..1) that a random piece in hand is a bomb. */
  bombs?: number;
  /** Chance (0..1) that a cell of a rising row is a stone. */
  stones?: number;
  /** Checked after every drop. Returning true ends the game as a win. */
  goalMet?: (game: Game) => boolean;
}

export interface DropOutcome {
  kind: 'dropped';
  /** The dropped piece. Absent for a hammer smash. */
  placed?: { tile: Tile; row: number; col: number };
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
  /** Whether the piece in hand (and the next one) is a bomb. */
  currentBomb = false;
  nextBomb = false;
  stonesBroken = 0;
  /** Layers of ice melted. */
  thawed = 0;
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
            const t = parseCell(line[c]);
          if (t) this.grid[top + i][c] = { id: this.nextId++, ...t };
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
    [this.current, this.currentBomb] = this.takeNext();
    [this.next, this.nextBomb] = this.takeNext();
    this.stonesBroken = 0;
    this.thawed = 0;
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

  private takeNext(): [number, boolean] {
    if (this.queue.length) return [this.queue.shift()!, false];
    const v = spawnValue(this.rng, this.config.maxValue);
    const bomb = !!this.config.bombs && this.rng() < this.config.bombs;
    return [v, bomb];
  }

  /** Stones and frozen pieces still on the board. */
  get stonesLeft(): number {
    return this.grid.reduce((n, row) => n + row.filter((t) => isStone(t)).length, 0);
  }
  get iceLeft(): number {
    return this.grid.reduce((n, row) => n + row.reduce((m, t) => m + (t?.ice ?? 0), 0), 0);
  }

  private makeTile(v = spawnValue(this.rng, this.config.maxValue)): Tile {
    return { id: this.nextId++, v };
  }

  /** Swaps the cat in hand with the next one. Free and unlimited: it is a planning tool. */
  swap(): boolean {
    if (this.over) return false;
    [this.current, this.next] = [this.next, this.current];
    [this.currentBomb, this.nextBomb] = [this.nextBomb, this.currentBomb];
    this.swaps++;
    return true;
  }

  canDrop(col: number): boolean {
    return !this.over && landingRow(this.grid, col) >= 0;
  }

  /** Pick: the piece in hand becomes size v (not a bomb). */
  pick(v: number): boolean {
    if (this.over || v < 1 || v > MAX_VALUE) return false;
    this.current = v;
    this.currentBomb = false;
    return true;
  }

  private count(waves: Wave[]): void {
    for (const w of waves) {
      for (const p of w.popped) {
        if (isStone(p.tile)) {
          this.stonesBroken++;
          continue;
        }
        this.slept++;
        this.sleptBySize[p.tile.v]++;
      }
      // A frozen piece broken outright (by a bomb or hammer) counts its ice as melted too.
      this.thawed += w.thawed.length + w.popped.reduce((n, p) => n + (p.tile.ice ?? 0), 0);
    }
  }

  /**
   * Hammer: breaks the piece at (r, c) (with its blast) and runs the cascade.
   * Does not use a drop. Returns null if there is nothing there.
   */
  smash(r: number, c: number): DropOutcome | null {
    if (this.over || !this.grid[r]?.[c]) return null;
    const waves = smashCell(this.grid, r, c);
    this.count(waves);
    const points = waves.reduce((s, w) => s + w.points, 0);
    this.score += points;
    this.longestChain = Math.max(this.longestChain, waves.length - 1);
    const won = this.config.goalMet?.(this) ?? false;
    if (won) {
      this.won = true;
      this.over = true;
      this.endReason = 'won';
    }
    return { kind: 'dropped', waves, gameOver: this.over, won, points };
  }

  drop(col: number): DropOutcome | BlockedOutcome {
    if (!this.canDrop(col)) return { kind: 'blocked' };
    const row = landingRow(this.grid, col);
    const tile = this.makeTile(this.current);
    if (this.currentBomb) tile.kind = 'bomb';
    this.grid[row][col] = tile;
    this.current = this.next;
    this.currentBomb = this.nextBomb;
    [this.next, this.nextBomb] = this.takeNext();
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
          const stones = this.config.stones ?? 0;
          const newRow = Array.from({ length: this.cols }, () =>
            stones && this.rng() < stones ? ({ id: this.nextId++, v: 0, kind: 'stone' } as Tile) : this.makeTile(),
          );
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

/** One board character as a tile (without id), or null for empty. See GameConfig.board. */
export function parseCell(ch: string | undefined): Omit<Tile, 'id'> | null {
  if (!ch) return null;
  if (ch === '#') return { v: 0, kind: 'stone' };
  if (ch >= '1' && ch <= '6') return { v: Number(ch) };
  if (ch >= 'a' && ch <= 'f') return { v: ch.charCodeAt(0) - 96, ice: 1 };
  if (ch >= 'A' && ch <= 'F') return { v: ch.charCodeAt(0) - 64, kind: 'bomb' };
  return null;
}
