/**
 * Level tuning: plays every level many times with a careless bot (random drops)
 * and a decent bot (best points next drop, using swap, with some mistakes), then prints win
 * rates and the final scores of wins, for setting drop limits and star scores.
 * Run: npm run levels
 */
import { Game } from '../src/core/game';
import { levelConfig, levelResult, type LevelDef } from '../src/core/level';
import { LEVELS } from '../src/core/levels';
import { findPops, previewDrop } from '../src/core/rules';

type Bot = (g: Game, rnd: () => number) => number;
const open = (g: Game) => [...Array(g.cols).keys()].filter((c) => g.canDrop(c));
const randomBot: Bot = (g, rnd) => {
  const o = open(g);
  return o[Math.floor(rnd() * o.length)];
};
const decentBot: Bot = (g, rnd) => {
  if (rnd() < 0.2) return randomBot(g, rnd);
  // Looks at both the cat in hand and the next one, and swaps when the next one is better.
  let best = -1;
  let bestScore = -Infinity;
  let bestSwap = false;
  for (const swap of [false, true]) {
    const v = swap ? g.next : g.current;
    for (const c of open(g)) {
      const p = previewDrop(g.grid, c, v)!;
      const s = p.points * 10 + p.waves * 50 + p.row - (swap ? 1 : 0);
      if (s > bestScore) {
        bestScore = s;
        best = c;
        bestSwap = swap;
      }
    }
  }
  if (bestSwap) g.swap();
  return best;
};

function play(def: LevelDef, bot: Bot, seed: number): { won: boolean; score: number } {
  const g = new Game(seed, levelConfig(def));
  let s = seed * 31 + 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  while (!g.over) g.drop(bot(g, rnd));
  const r = levelResult(def, g);
  return { won: g.won, score: r.score };
}

const RUNS = 300;
const pct = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] : 0);
console.log('level        stable  random-win  decent-win   decent win score p50 / p80');
for (const def of LEVELS) {
  const stable = findPops(new Game(1, levelConfig(def)).grid).length === 0;
  const rnd = Array.from({ length: RUNS }, (_, i) => play(def, randomBot, i + 1));
  const dec = Array.from({ length: RUNS }, (_, i) => play(def, decentBot, i + 1));
  const rate = (a: { won: boolean }[]) => `${Math.round((100 * a.filter((x) => x.won).length) / a.length)}%`.padStart(4);
  const wins = dec.filter((x) => x.won).map((x) => x.score);
  console.log(
    `${(def.id + ' ' + def.name).padEnd(18)} ${String(stable).padEnd(7)} ${rate(rnd).padStart(10)} ${rate(dec).padStart(11)}   ${pct(wins, 0.5)} / ${pct(wins, 0.8)}`,
  );
}
