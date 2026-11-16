import type { LevelDef } from './level';

/**
 * Hand-made levels. Boards are bottom-aligned ('.' empty, digits are piece sizes)
 * and must be stable: nothing may pop before the first drop (tests check this).
 * Run `npm run levels` to see how often bots win each level when tuning.
 */
/**
 * Worlds. Each has its own theme (art and words); the rules are shared. The
 * tutorial uses the first world's theme (gems) because it teaches with its pieces.
 */
export interface World {
  id: string;
  name: string;
  blurb: string;
  theme: string;
}
export const WORLDS: World[] = [
  { id: 'tutorial', name: 'First Light', blurb: 'Learn the basics', theme: 'gems' },
  { id: 'grotto', name: 'Gem Grotto', blurb: 'A glittering cave', theme: 'gems' },
  { id: 'alley', name: 'Cat Nap Alley', blurb: 'Dusk on the rooftops', theme: 'cats' },
];

export const worldOf = (def: LevelDef): World => WORLDS.find((w) => w.id === def.world) ?? WORLDS[0];

export const LEVELS: LevelDef[] = [
  /* ---------- tutorial: one idea per lesson, tiny boards, fixed pieces, a guide arrow ---------- */
  {
    id: 't1',
    world: 'tutorial',
    name: 'Count down',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['1..1'],
    queue: [1, 1, 1, 1],
    drops: 4,
    stars: [0, 0],
    tips: [
      { col: 1, text: 'A gem shows sparks it has over sparks it needs: 0/1 needs 1 spark. Each gem gives its own number to the gems it touches. Drop your 1 next to the other 1.' },
      { col: 2, text: 'Both hit 1/1, exactly full, so both broke! Do it again.' },
    ],
  },
  {
    id: 't2',
    world: 'tutorial',
    name: 'Add it up',
    goal: { kind: 'sleep', count: 1, size: 3 },
    rows: 4,
    cols: 4,
    board: ['.3..'],
    queue: [1, 2, 1, 1],
    drops: 4,
    stars: [0, 0],
    tips: [
      { col: 0, text: 'This triangle is 0/3. Your round gem gives 1. Drop it beside the triangle and watch it fill.' },
      { col: 2, text: 'Now it is 1/3. Your lens gives 2. Drop it on the other side to make 3/3.' },
    ],
  },
  {
    id: 't3',
    world: 'tutorial',
    name: 'Too many',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['1...', '2...'],
    queue: [1, 1, 1, 1],
    drops: 4,
    stars: [0, 0],
    tips: [
      { col: 1, text: 'Red means too many. The top gem is 2/1, so it is stuck until a neighbor leaves. Break the lens under it.' },
    ],
  },
  {
    id: 't4',
    world: 'tutorial',
    name: 'Twins',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['..11', '..33'],
    queue: [3, 3, 3],
    drops: 3,
    stars: [0, 0],
    tips: [
      { col: 1, text: 'Touching gems of the same shape break together. Break one triangle and its twins go too. Then watch what falls.' },
    ],
  },
  {
    id: 't5',
    world: 'tutorial',
    name: 'Swap',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['2...'],
    queue: [1, 2, 1, 1],
    drops: 3,
    stars: [0, 0],
    tips: [
      { swap: true, col: 1, text: 'The lens is 0/2, but your gem only gives 1. Tap Swap to use the next gem instead.' },
    ],
  },

  /* ---------- Gem Grotto: each level is built around one idea, on a small board ---------- */
  {
    id: 'g1',
    world: 'grotto',
    name: 'First glimmer',
    coach: 'Fill each gem exactly: 2/2 breaks, 3/2 is too many. Hold a column to see which gems you would touch.',
    goal: { kind: 'sleep', count: 6 },
    rows: 6,
    cols: 5,
    board: ['1...2', '2.1.3'],
    maxValue: 3,
    drops: 12,
    stars: [660, 700],
  },
  {
    id: 'g2',
    world: 'grotto',
    name: 'Rock garden',
    coach: 'Stones never fill. Break a gem right next to a stone and the stone crumbles too.',
    goal: { kind: 'stones' },
    rows: 6,
    cols: 5,
    board: ['#...#', '3#.#2', '21#21'],
    maxValue: 3,
    drops: 12,
    stars: [700, 800],
  },
  {
    id: 'g3',
    world: 'grotto',
    name: 'Domino',
    coach: 'When a gem breaks, the gems above fall and touch new neighbors. Lantern shows the whole chain before you drop. You get 3.',
    goal: { kind: 'chain', length: 2 },
    rows: 6,
    cols: 5,
    board: ['..4..', '..3..', '1.4.1'],
    maxValue: 4,
    drops: 10,
    stars: [540, 600],
  },
  {
    id: 'g4',
    world: 'grotto',
    name: 'Hammer time',
    coach: 'New: Hammer. Tap it, then tap any piece to smash it, stones too. It doesn\'t use a drop, and you get 2.',
    goal: { kind: 'stones' },
    rows: 7,
    cols: 5,
    board: ['#...#', '#...#', '1#.#2', '23#21'],
    maxValue: 4,
    drops: 16,
    stars: [920, 1080],
  },
  {
    id: 'g5',
    world: 'grotto',
    name: 'Frozen pool',
    coach: 'New: ice. A frozen gem still gives sparks but can\'t break. Break a gem next to it to melt the ice.',
    goal: { kind: 'ice' },
    rows: 6,
    cols: 5,
    board: ['.a.a.', '.1.1.', 'a1.2b'],
    maxValue: 3,
    drops: 7,
    stars: [610, 640],
  },
  {
    id: 'g6',
    world: 'grotto',
    name: 'Rising floor',
    coach: 'New rows rise from below every few drops, and some bring stones. Break 6 stones before the cave fills.',
    goal: { kind: 'stones', count: 6 },
    rows: 7,
    cols: 5,
    board: ['2#.#4', '12#13'],
    maxValue: 4,
    rise: { first: 6, min: 5 },
    stones: 0.2,
    drops: 24,
    stars: [1480, 1620],
  },
  {
    id: 'g7',
    world: 'grotto',
    name: 'Clean sweep',
    coach: 'New: Pick. Once per level, choose exactly the gem you need.',
    goal: { kind: 'clear' },
    rows: 6,
    cols: 5,
    board: ['2...2', '1#.#1', '12#21'],
    maxValue: 3,
    drops: 12,
    stars: [750, 820],
  },
  {
    id: 'g8',
    world: 'grotto',
    name: 'Blasting cap',
    coach: 'New: bomb gems. When one breaks, everything around it breaks too, stones and ice included. Some gems you drop are bombs.',
    goal: { kind: 'stones' },
    rows: 7,
    cols: 5,
    board: ['#...#', '#.#.#', '3D#D3'],
    maxValue: 4,
    bombs: 0.12,
    drops: 14,
    stars: [820, 890],
  },
  {
    id: 'g9',
    world: 'grotto',
    name: 'Ice and stone',
    coach: 'Hexagons give 6 sparks to every gem they touch. Watch the rising rows: some bring stones.',
    goal: { kind: 'ice' },
    board: ['a....d', '#a..a#', '1#21#2'],
    maxValue: 6,
    rise: { first: 9, min: 7 },
    stones: 0.15,
    drops: 14,
    stars: [880, 1000],
  },  {
    id: 'g10',
    world: 'grotto',
    name: 'Triple shine',
    goal: { kind: 'chain', length: 3 },
    board: ['1.4..4', '4.2.31', '152515'],
    maxValue: 5,
    rise: { first: 10, min: 7 },
    bombs: 0.1,
    drops: 30,
    stars: [2450, 2650],
  },  {
    id: 'g11',
    world: 'grotto',
    name: 'Fortress',
    coach: 'Stones walled in with ice. Set off the bombs to break through.',
    goal: { kind: 'stones' },
    board: ['#.##.#', '#c##d#', '4C51D5'],
    maxValue: 5,
    bombs: 0.08,
    drops: 14,
    stars: [1460, 1590],
  },
  {
    id: 'g12',
    world: 'grotto',
    name: 'Heart of the cave',
    goal: { kind: 'score', target: 1800 },
    board: ['..#...', '.6#3..', '5B5#F3', '26#426'],
    maxValue: 6,
    rise: { first: 9, min: 6 },
    bombs: 0.08,
    stones: 0.1,
    drops: 34,
    stars: [2350, 2750],
  },
  /* ---------- Cat Nap Alley (world 2: bigger cats, faster rising) ---------- */
  {
    id: 'c1',
    world: 'alley',
    name: 'Rooftop dusk',
    coach: 'Cats work like gems: the bubble shows hearts it has over hearts it needs. Bigger cats need more.',
    goal: { kind: 'sleep', count: 18 },
    board: ['.2...3', '31.3.2', '115131'],
    maxValue: 5,
    rise: { first: 9, min: 7 },
    drops: 20,
    stars: [1250, 1400],
  },
  {
    id: 'c2',
    world: 'alley',
    name: 'Ginger roof',
    goal: { kind: 'sleep', count: 6, size: 2 },
    board: ['.31...', '415..5', '141511'],
    maxValue: 5,
    rise: { first: 9, min: 7 },
    drops: 24,
    stars: [1600, 1850],
  },
  {
    id: 'c3',
    world: 'alley',
    name: 'Siamese stairs',
    goal: { kind: 'sleep', count: 5, size: 4 },
    board: ['.4..4.', '.3.525', '413162'],
    maxValue: 6,
    rise: { first: 9, min: 7 },
    drops: 26,
    stars: [1650, 1850],
  },
  {
    id: 'c4',
    world: 'alley',
    name: 'Chimney chain',
    goal: { kind: 'chain', length: 3 },
    board: ['3.4...', '2.1...', '2.3.3.', '251412'],
    maxValue: 6,
    rise: { first: 9, min: 6 },
    bombs: 0.08,
    drops: 28,
    stars: [1900, 2100],
  },
  {
    id: 'c5',
    world: 'alley',
    name: 'Calico corner',
    goal: { kind: 'sleep', count: 5, size: 5 },
    board: ['3.2.4.', '141515', '114163'],
    maxValue: 6,
    rise: { first: 8, min: 6 },
    drops: 28,
    stars: [1850, 2250],
  },
  {
    id: 'c6',
    world: 'alley',
    name: 'Big chonk',
    coach: 'Chonks are the biggest cats: 6 hearts. Surround them with warmth.',
    goal: { kind: 'sleep', count: 4, size: 6 },
    board: ['.6.4..', '.3.3.3', '13.5.2', '636151'],
    maxValue: 6,
    rise: { first: 8, min: 6 },
    stones: 0.12,
    drops: 30,
    stars: [2100, 2300],
  },
  {
    id: 'c7',
    world: 'alley',
    name: 'Lantern street',
    goal: { kind: 'score', target: 2000 },
    board: ['....5.', '.1..24', '.61161', '531413'],
    maxValue: 6,
    rise: { first: 8, min: 6 },
    bombs: 0.1,
    drops: 36,
    stars: [2600, 2950],
  },
  {
    id: 'c8',
    world: 'alley',
    name: 'Moonrise',
    goal: { kind: 'score', target: 2500 },
    board: ['....5.', '..3.31', '.41611', '315225'],
    maxValue: 6,
    rise: { first: 8, min: 5 },
    drops: 34,
    stars: [2850, 3250],
  },
];

/** Power-ups unlock as you go: each is available from this level on (always in Endless). */
export const TOOL_UNLOCK = { lantern: 'g3', hammer: 'g4', pick: 'g7' } as const;
export type Tool = keyof typeof TOOL_UNLOCK;

export function toolAvailable(tool: Tool, def?: LevelDef): boolean {
  if (!def) return true;
  if (def.world === 'tutorial') return false;
  return LEVELS.indexOf(def) >= LEVELS.findIndex((l) => l.id === TOOL_UNLOCK[tool]);
}

export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
