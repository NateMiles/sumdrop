/**
 * Balance check: plays many seeded games with a random bot and a one-move-lookahead
 * bot, then prints how long games last and what they score. Run: npm run sim
 */
import { Game } from '../src/core/game';
import { COLS, previewDrop } from '../src/core/rules';

type Bot = (g: Game) => number;
const randomBot: Bot = (g) => {
  const open = [...Array(COLS).keys()].filter((c) => g.canDrop(c));
  return open[Math.floor(Math.random() * open.length)];
};
const greedyBot: Bot = (g) => {
  let best = -1;
  let bestScore = -Infinity;
  for (let c = 0; c < COLS; c++) {
    const p = previewDrop(g.grid, c, g.current);
    if (!p) continue;
    const s = p.points * 10 + p.row; // prefer points, then lower landing spots
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
};

function run(name: string, bot: Bot, games = 200): void {
  const drops: number[] = [];
  const scores: number[] = [];
  const chains: number[] = [];
  for (let i = 0; i < games; i++) {
    const g = new Game(i + 1);
    while (!g.over && g.drops < 5000) {
      const c = bot(g);
      if (c < 0) break;
      g.drop(c);
    }
    drops.push(g.drops);
    scores.push(g.score);
    chains.push(g.longestChain);
  }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`${name.padEnd(8)} median drops ${med(drops)}  median score ${med(scores)}  median longest chain ${med(chains)}  max chain ${Math.max(...chains)}`);
}

run('random', randomBot);
run('greedy', greedyBot);
