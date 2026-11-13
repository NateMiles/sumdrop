import type { Game, GameConfig } from './game';

/** What a level asks for. */
export type Goal =
  /** Put this many cats to sleep (only cats of size `size`, if given). */
  | { kind: 'sleep'; count: number; size?: number }
  /** Reach this score. */
  | { kind: 'score'; target: number }
  /** Make a chain reaction at least this long. */
  | { kind: 'chain'; length: number }
  /** Put every cat on the board to sleep. */
  | { kind: 'clear' };

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
  rows?: number;
  cols?: number;
  board?: string[];
  queue?: number[];
  maxValue?: number;
  /** Rising rows. Omitted means no rising. */
  rise?: { first: number; min: number };
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
  }
}

export const SIZE_NAMES = ['', 'kittens', 'gingers', 'blues', 'siamese', 'calicos', 'chonks'];

export function goalText(goal: Goal): string {
  switch (goal.kind) {
    case 'sleep':
      return goal.size ? `Tuck in ${goal.count} ${SIZE_NAMES[goal.size]}` : `Tuck in ${goal.count} cats`;
    case 'score':
      return `Score ${goal.target.toLocaleString('en-US')}`;
    case 'chain':
      return `Make a ×${goal.length} chain`;
    case 'clear':
      return 'Tuck in every cat';
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
    goalMet: (g) => goalMet(def.goal, g),
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
