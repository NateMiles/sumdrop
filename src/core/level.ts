import type { Game, GameConfig } from './game';

/** What a level asks for. */
export type Goal =
  /** Clear this many pieces (only pieces of size `size`, if given). */
  | { kind: 'sleep'; count: number; size?: number }
  /** Reach this score. */
  | { kind: 'score'; target: number }
  /** Make a chain reaction at least this long. */
  | { kind: 'chain'; length: number }
  /** Clear every piece on the board. */
  | { kind: 'clear' }
  /** Break every stone, or this many stones (for boards where stones keep rising). */
  | { kind: 'stones'; count?: number }
  /** Melt all the ice. */
  | { kind: 'ice' };

/** One step of a tutorial: what to say, and where to point. */
export interface Tip {
  text: string;
  /** Column the guide arrow points at. */
  col?: number;
  /** Point at the Swap button first (until the player swaps). */
  swap?: boolean;
}

export interface LevelDef {
  id: string;
  world: string;
  /** Short name shown on the map and the level card. */
  name: string;
  goal: Goal;
  /** Drop limit. */
  drops: number;
  /** Score for 2 and 3 stars. Meeting the goal is always 1 star. */
  stars: [number, number];
  /** Coaching line shown above the board (tutorial levels). */
  coach?: string;
  /** Step-by-step coaching for tutorials: tips[n] shows before drop n. Falls back to coach. */
  tips?: Tip[];
  rows?: number;
  cols?: number;
  board?: string[];
  queue?: number[];
  maxValue?: number;
  /** Rising rows. Omitted means no rising. */
  rise?: { first: number; min: number };
  /** Chance a random piece in hand is a bomb. */
  bombs?: number;
  /** Chance a cell of a rising row is a stone. */
  stones?: number;
}

/** The tip for the drop the player is about to make, if any. */
export function currentTip(def: LevelDef, game: Game): Tip | undefined {
  return game.over ? undefined : def.tips?.[game.drops];
}

/** Points per drop left over when a level is won. */
export const LEFTOVER_BONUS = 60;

export function goalMet(goal: Goal, game: Game): boolean {
  switch (goal.kind) {
    case 'sleep':
      return (goal.size ? game.sleptBySize[goal.size] : game.slept) >= goal.count;
    case 'score':
      return game.score >= goal.target;
    case 'chain':
      return game.longestChain >= goal.length;
    case 'clear':
      return game.grid.every((row) => row.every((t) => !t));
    case 'stones':
      return goal.count ? game.stonesBroken >= goal.count : game.stonesLeft === 0;
    case 'ice':
      return game.iceLeft === 0;
  }
}

/** Current and target numbers for the goal meter. */
export function goalProgress(goal: Goal, game: Game): { have: number; need: number } {
  switch (goal.kind) {
    case 'sleep':
      return { have: goal.size ? game.sleptBySize[goal.size] : game.slept, need: goal.count };
    case 'score':
      return { have: game.score, need: goal.target };
    case 'chain':
      return { have: game.longestChain, need: goal.length };
    case 'clear': {
      const left = game.grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
      return { have: game.slept, need: game.slept + left };
    }
    case 'stones':
      return goal.count ? { have: game.stonesBroken, need: goal.count } : { have: game.stonesBroken, need: game.stonesBroken + game.stonesLeft };
    case 'ice':
      return { have: game.thawed, need: game.thawed + game.iceLeft };
  }
}

/** The world's words for goals. Neutral defaults keep the core free of any theme. */
export interface GoalWords {
  pieces: string;
  sizeNames: readonly string[];
  clearVerb: string;
}
export const NEUTRAL_WORDS: GoalWords = {
  pieces: 'pieces',
  sizeNames: ['', '1s', '2s', '3s', '4s', '5s', '6s'],
  clearVerb: 'Clear',
};

export function goalText(goal: Goal, w: GoalWords = NEUTRAL_WORDS): string {
  switch (goal.kind) {
    case 'sleep':
      return `${w.clearVerb} ${goal.count} ${goal.size ? w.sizeNames[goal.size] : w.pieces}`;
    case 'score':
      return `Score ${goal.target.toLocaleString('en-US')}`;
    case 'chain':
      return `Make a ×${goal.length} chain`;
    case 'clear':
      return `${w.clearVerb} all the ${w.pieces}`;
    case 'stones':
      return goal.count ? `Break ${goal.count} stones` : 'Break every stone';
    case 'ice':
      return 'Melt all the ice';
  }
}

export function levelConfig(def: LevelDef): GameConfig {
  return {
    rows: def.rows,
    cols: def.cols,
    board: def.board,
    startRows: def.board ? undefined : 0,
    queue: def.queue,
    maxValue: def.maxValue,
    rise: def.rise ?? null,
    maxDrops: def.drops,
    bombs: def.bombs,
    stones: def.stones,
    goalMet: (g) => goalMet(def.goal, g),
    // Levels with star scores let you play on for more stars; tutorials end at the goal.
    keepGoing: def.stars[1] > 0,
  };
}

/** Final score with the leftover-drop bonus, and the stars it earns. 0 stars means the level was lost. */
export function levelResult(def: LevelDef, game: Game): { score: number; bonus: number; stars: number } {
  if (!game.won) return { score: game.score, bonus: 0, stars: 0 };
  const bonus = game.dropsLeft * LEFTOVER_BONUS;
  const score = game.score + bonus;
  const stars = score >= def.stars[1] ? 3 : score >= def.stars[0] ? 2 : 1;
  return { score, bonus, stars };
}
