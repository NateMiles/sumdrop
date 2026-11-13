import type { LevelDef } from './level';

/**
 * Hand-made levels. Boards are bottom-aligned ('.' empty, digits are piece sizes)
 * and must be stable: nothing may pop before the first drop (tests check this).
 * Run `npm run levels` to see how often bots win each level when tuning.
 */
/**
 * Worlds. Each has its own theme (art and words); the rules are shared. The
 * tutorial uses the cat theme because it teaches with the first world's pieces.
 */
export interface World {
  id: string;
  name: string;
  blurb: string;
  theme: string;
}
export const WORLDS: World[] = [
  { id: 'tutorial', name: 'First Nap', blurb: 'Learn the basics', theme: 'cats' },
  { id: 'alley', name: 'Cat Nap Alley', blurb: 'Dusk on the rooftops', theme: 'cats' },
];

export const worldOf = (def: LevelDef): World => WORLDS.find((w) => w.id === def.world) ?? WORLDS[0];

export const LEVELS: LevelDef[] = [
  /* ---------- tutorial: tiny boards, fixed cats, no rising ---------- */
  {
    id: 't1',
    world: 'tutorial',
    name: 'Kittens',
    coach: 'A cat falls asleep when all its hearts are filled. A kitten has 1. Drop a kitten right next to another one.',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['1..1'],
    queue: [1, 1, 1, 1],
    drops: 4,
    stars: [0, 0],
  },
  {
    id: 't2',
    world: 'tutorial',
    name: 'Bigger cats',
    coach: 'Each touching cat fills as many hearts as it has. A ginger has 2: drop it between two kittens.',
    goal: { kind: 'clear' },
    rows: 4,
    cols: 4,
    board: ['1.1.'],
    queue: [2, 1, 1, 1],
    drops: 4,
    stars: [0, 0],
  },
  {
    id: 't3',
    world: 'tutorial',
    name: 'Chain naps',
    coach: 'When cats fall asleep, the cats above slide down and can fall asleep too. Tuck in the blues.',
    goal: { kind: 'chain', length: 2 },
    rows: 4,
    cols: 4,
    board: ['..11', '..33'],
    queue: [3, 3, 3],
    drops: 3,
    stars: [0, 0],
  },

  /* ---------- Cat Nap Alley ---------- */
  {
    id: 'a1',
    world: 'alley',
    name: 'First night',
    coach: 'Hollow hearts show what a cat still needs. No good spot? Tap Swap to use the next cat first.',
    goal: { kind: 'sleep', count: 10 },
    rows: 7,
    board: ['.3.2.3', '213131'],
    maxValue: 3,
    drops: 22,
    stars: [1400, 1550],
  },
  {
    id: 'a2',
    world: 'alley',
    name: 'Blue hour',
    coach: 'Night light shows every cat your next drop puts to sleep, chains included. You get 3 per level.',
    goal: { kind: 'sleep', count: 14 },
    rows: 7,
    board: ['.3....', '.1.3.3', '314141'],
    maxValue: 4,
    drops: 22,
    stars: [1350, 1400],
  },
  {
    id: 'a3',
    world: 'alley',
    name: 'Ginger roof',
    goal: { kind: 'sleep', count: 5, size: 2 },
    board: ['.4....', '.14.4.', '141423'],
    maxValue: 4,
    drops: 22,
    stars: [1250, 1350],
  },
  {
    id: 'a4',
    world: 'alley',
    name: 'Domino',
    goal: { kind: 'chain', length: 2 },
    board: ['..3..3', '3.14.2', '141141'],
    maxValue: 4,
    drops: 12,
    stars: [1200, 1250],
  },
  {
    id: 'a5',
    world: 'alley',
    name: 'Lantern light',
    goal: { kind: 'score', target: 900 },
    board: ['..3..4', '2.14.1', '114113'],
    maxValue: 4,
    drops: 24,
    stars: [1250, 1500],
  },
  {
    id: 'a6',
    world: 'alley',
    name: 'Rising tide',
    coach: 'New rows rise from below every few drops. Keep the alley from filling up.',
    goal: { kind: 'sleep', count: 22 },
    board: ['...4..', '.3.1.2', '414241'],
    maxValue: 4,
    rise: { first: 10, min: 8 },
    drops: 22,
    stars: [1350, 1500],
  },
  {
    id: 'a7',
    world: 'alley',
    name: 'Siamese',
    goal: { kind: 'sleep', count: 4, size: 4 },
    board: ['4..5.3', '14.4.2', '413153'],
    maxValue: 5,
    rise: { first: 10, min: 8 },
    drops: 20,
    stars: [1300, 1400],
  },
  {
    id: 'a8',
    world: 'alley',
    name: 'Quiet street',
    goal: { kind: 'clear' },
    board: ['..2...', '.13.3.', '213321'],
    maxValue: 3,
    drops: 14,
    stars: [900, 1050],
  },
  {
    id: 'a9',
    world: 'alley',
    name: 'Calico corner',
    goal: { kind: 'sleep', count: 4, size: 5 },
    board: ['2..4..', '5..3..', '2..5.2', '513151'],
    maxValue: 5,
    rise: { first: 10, min: 7 },
    drops: 26,
    stars: [1550, 1700],
  },
  {
    id: 'a10',
    world: 'alley',
    name: 'Triple dream',
    goal: { kind: 'chain', length: 3 },
    board: ['1.4..4', '4.2.31', '152515'],
    maxValue: 5,
    rise: { first: 10, min: 7 },
    drops: 30,
    stars: [2450, 2650],
  },
  {
    id: 'a11',
    world: 'alley',
    name: 'Big chonk',
    coach: 'Chonks are the biggest cats: 6 hearts. Watch which hearts are still hollow.',
    goal: { kind: 'sleep', count: 3, size: 6 },
    board: ['4.....', '3....5', '6.2.42', '131314'],
    maxValue: 6,
    rise: { first: 10, min: 7 },
    drops: 27,
    stars: [1700, 1900],
  },
  {
    id: 'a12',
    world: 'alley',
    name: 'Moonrise',
    goal: { kind: 'score', target: 1800 },
    board: ['.2...2', '.1.2.1', '.4.1.5', '314232'],
    maxValue: 6,
    rise: { first: 9, min: 6 },
    drops: 34,
    stars: [2350, 2750],
  },
];

export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
