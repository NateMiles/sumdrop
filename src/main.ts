import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import './style.css';

import { Game } from './core/game';
import { BoardView } from './ui/board';
import { Sfx } from './ui/audio';
import { haptics, storage } from './ui/platform';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const game = new Game();
const sfx = new Sfx();
let best = 0;
let shownScore = 0;

const canvas = $<HTMLCanvasElement>('#board');
const board = new BoardView(canvas, game, sfx, {
  onScore(delta) {
    shownScore += delta;
    renderHud();
  },
  onSettled() {
    shownScore = game.score;
    renderHud();
    if (game.over) showGameOver();
  },
});

function renderHud(): void {
  $('#score').textContent = String(shownScore);
  if (shownScore > best) {
    best = shownScore;
    void storage.set('best', best);
  }
  $('#best').textContent = String(best);
  $('#pips').innerHTML = Array.from({ length: game.riseEvery }, (_, i) => `<i class="${i < game.untilRise ? 'on' : ''}"></i>`).join('');
  const soundBtn = $('#sound');
  soundBtn.textContent = sfx.muted ? 'Muted' : 'Sound';
  soundBtn.setAttribute('aria-pressed', String(!sfx.muted));
}

function showGameOver(): void {
  sfx.over();
  haptics.error();
  $('#over-text').textContent = `Score ${game.score} · Best ${best} · Longest chain ×${game.longestChain}`;
  $('#over').hidden = false;
}

function newGame(): void {
  game.reset((Math.random() * 2 ** 31) | 0);
  board.sync();
  shownScore = 0;
  $('#over').hidden = true;
  renderHud();
}

async function drop(col: number): Promise<void> {
  if (board.busy || game.over) return;
  const out = game.drop(col);
  if (out.kind === 'blocked') {
    board.bump(0.6);
    sfx.blocked();
    haptics.error();
    return;
  }
  if (board.showHint) {
    board.showHint = false;
    void storage.set('seenHint', true);
  }
  renderHud();
  await board.play(out);
}

/* input: hold to preview, slide between columns, release to drop */
canvas.addEventListener('pointermove', (e) => {
  board.mouse = e.pointerType === 'mouse';
  board.hover = board.columnAt(e.clientX);
});
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') board.mouse = false;
});
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  board.mouse = e.pointerType === 'mouse';
  board.pressing = true;
  board.hover = board.columnAt(e.clientX);
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!board.pressing) return;
  board.pressing = false;
  board.hover = board.columnAt(e.clientX);
  void drop(board.hover);
});
canvas.addEventListener('pointercancel', () => {
  board.pressing = false;
});

$('#restart').addEventListener('click', newGame);
$('#again').addEventListener('click', newGame);
$('#sound').addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  void storage.set('muted', sfx.muted);
  if (!sfx.muted) {
    sfx.unlock();
    sfx.toggleChime();
  }
  renderHud();
});

/* layout */
const resize = () => board.resize();
addEventListener('resize', resize);
new ResizeObserver(resize).observe($('#stage'));
void document.fonts?.ready.then(resize);

/* loop */
let last = performance.now();
function frame(t: number): void {
  const dt = Math.min(50, t - last);
  last = t;
  board.draw(t, dt);
  requestAnimationFrame(frame);
}

async function boot(): Promise<void> {
  best = await storage.get('best', 0);
  sfx.muted = await storage.get('muted', false);
  board.showHint = !(await storage.get('seenHint', false));
  renderHud();
  requestAnimationFrame(frame);
}
void boot();

// Exposed for automated playtests and the balance script.
(window as unknown as { __sumdrop: unknown }).__sumdrop = { game, board, drop };
