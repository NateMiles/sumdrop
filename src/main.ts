import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import './style.css';

import { Game } from './core/game';
import { previewDrop } from './core/rules';
import { type LevelDef, goalProgress, goalText, levelConfig, levelResult } from './core/level';
import { LEVELS, WORLDS, nextLevel, worldOf } from './core/levels';
import { BoardView } from './ui/board';
import { Sfx } from './ui/audio';
import { DEFAULT_THEME, type Theme, themeById } from './themes';
import { haptics, storage } from './ui/platform';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const newSeed = () => (Math.random() * 2 ** 31) | 0;

type Mode = { kind: 'endless' } | { kind: 'level'; def: LevelDef };

const game = new Game();
const sfx = new Sfx();
let mode: Mode = { kind: 'endless' };
let best = 0;
let shownScore = 0;
/** Best stars per level id. A level is beaten when it has 1 or more. */
let progress: Record<string, number> = {};
/** Night light boosts left in this level or Endless run. */
const NIGHT_LIGHTS_PER_RUN = 3;
let nightLights = NIGHT_LIGHTS_PER_RUN;

/* ---------- small svg bits ---------- */

const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z';
const star = (on: boolean, cls = '') =>
  `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path d="${STAR_PATH}" fill="${on ? '#ffd27a' : '#3a3062'}" stroke="${on ? '#f2a46b' : '#4a3f78'}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
/** The theme in play: the level's world, or the default for Endless. */
const currentTheme = (): Theme => (mode.kind === 'level' ? themeById(worldOf(mode.def).theme) : DEFAULT_THEME);
const pieceImg = (theme: Theme, v: number) => `<img alt="" src="${theme.art.iconUrl(v)}">`;

/* ---------- board ---------- */

const canvas = $<HTMLCanvasElement>('#board');
const board = new BoardView(canvas, game, sfx, {
  onScore(delta) {
    shownScore += delta;
    renderHud();
  },
  onSettled() {
    shownScore = game.score;
    renderHud();
    if (game.over) showEnd();
  },
});

/* ---------- screens ---------- */

function showScreen(which: 'map' | 'play'): void {
  // The map uses the first world's backdrop; play uses the current world's.
  if (which === 'map') document.body.dataset.art = DEFAULT_THEME.id;
  $('#map').hidden = which !== 'map';
  $('#play').hidden = which !== 'play';
  document.body.classList.toggle('playing', which === 'play');
  if (which === 'play') requestAnimationFrame(() => board.resize());
}

const unlocked = (i: number) => i === 0 || (progress[LEVELS[i - 1].id] ?? 0) > 0;

function renderMap(): void {
  const total = Object.values(progress).reduce((a, b) => a + b, 0);
  $('#star-total').innerHTML = `${star(true)}<span>${total} / ${LEVELS.length * 3}</span>`;
  const currentIdx = LEVELS.findIndex((l, i) => unlocked(i) && !progress[l.id]);
  $('#worlds').innerHTML = WORLDS.map((w) => {
    const levels = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.world === w.id);
    const rowsN = Math.ceil(levels.length / 4);
    // Snake layout: even rows run left to right, odd rows right to left.
    const pos = (k: number) => {
      const row = Math.floor(k / 4);
      const col = row % 2 === 0 ? k % 4 : 3 - (k % 4);
      return { row, col };
    };
    const pts = levels.map((_, k) => {
      const { row, col } = pos(k);
      return `${12.5 + col * 25},${row * 98 + 27}`;
    });
    const h = rowsN * 76 + (rowsN - 1) * 22;
    const nodes = levels
      .map(({ l, i }, k) => {
        const { row, col } = pos(k);
        const open = unlocked(i);
        const stars = progress[l.id] ?? 0;
        const cls = ['node', open ? '' : 'locked', stars ? 'done' : '', i === currentIdx ? 'current' : ''].join(' ');
        const color = themeById(w.theme).art.color((k % 6) + 1);
        const label = open ? String(k + 1) : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';
        return `<button class="${cls}" style="grid-row:${row + 1};grid-column:${col + 1};--node:${color}" data-level="${l.id}" ${open ? '' : 'disabled'} aria-label="Level ${k + 1}, ${l.name}${open ? `, ${stars} stars` : ', locked'}">
          ${i === currentIdx ? `<span class="cat">${pieceImg(themeById(w.theme), 1)}</span>` : ''}
          <span class="disc">${label}</span>
          <span class="mini-stars">${open && stars ? [1, 2, 3].map((n) => star(n <= stars)).join('') : ''}</span>
        </button>`;
      })
      .join('');
    return `<section class="world"><h2>${w.name}</h2><p>${w.blurb}</p>
      <div class="path" style="height:${h}px">
        <svg viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="#4a3f78" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
        ${nodes}
      </div></section>`;
  }).join('');
  const cur = document.querySelector('.node.current');
  cur?.scrollIntoView({ block: 'center' });
  renderSound();
}

function renderSound(): void {
  const btn = $('#sound');
  btn.textContent = sfx.muted ? 'Muted' : 'Sound';
  btn.setAttribute('aria-pressed', String(!sfx.muted));
}

/* ---------- HUD ---------- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function renderTools(): void {
  const tutorial = mode.kind === 'level' && mode.def.world === 'tutorial';
  $('.tools').hidden = tutorial;
  const night = $<HTMLButtonElement>('#night');
  night.setAttribute('aria-pressed', String(board.nightLight));
  night.disabled = nightLights <= 0 && !board.nightLight;
  $('#night-count').textContent = String(nightLights);
  $<HTMLButtonElement>('#swap').disabled = game.over;
}

function renderHud(): void {
  renderTools();
  const isLevel = mode.kind === 'level';
  $('#score').textContent = String(shownScore);
  if (!isLevel && shownScore > best) {
    best = shownScore;
    void storage.set('best', best);
  }
  $('#best').textContent = String(best);
  $('#best-stat').hidden = isLevel;
  $('#rise-stat').hidden = !game.rising;
  $('#pips').innerHTML = Array.from({ length: game.riseEvery }, (_, i) => `<i class="${i < game.untilRise ? 'on' : ''}"></i>`).join('');
  $('#goal-stat').hidden = !isLevel;
  $('#drops-stat').hidden = !isLevel;
  $('#starbar').hidden = mode.kind !== 'level' || mode.def.stars[1] === 0;
  if (mode.kind !== 'level') return;
  const { def } = mode;
  const p = goalProgress(def.goal, game);
  const g = def.goal;
  const pieces = cap(currentTheme().words.pieces);
  $('#goal-label').textContent =
    g.kind === 'sleep' ? (g.size ? 'Goal' : pieces) : g.kind === 'score' ? 'Target' : g.kind === 'chain' ? 'Chain' : `${pieces} left`;
  $('#goal-num').textContent =
    g.kind === 'score' ? String(g.target) : g.kind === 'clear' ? String(p.need - p.have) : `${Math.min(p.have, p.need)}/${p.need}`;
  $('#drops').textContent = String(game.dropsLeft);
  $('#drops-stat').classList.toggle('low', game.dropsLeft <= 3);
  if (def.stars[1]) {
    const top = def.stars[1] * 1.1;
    $('#starfill').style.width = `${Math.min(100, (100 * shownScore) / top)}%`;
    $('#notch1').style.left = `${(100 * def.stars[0]) / top}%`;
    $('#notch2').style.left = `${(100 * def.stars[1]) / top}%`;
  }
}

/* ---------- starting play ---------- */

function startEndless(): void {
  mode = { kind: 'endless' };
  game.load({}, newSeed());
  enterPlay();
}

function startLevel(def: LevelDef, intro = true): void {
  mode = { kind: 'level', def };
  game.load(levelConfig(def), newSeed());
  enterPlay();
  if (intro) showIntro(def);
}

function enterPlay(): void {
  nightLights = NIGHT_LIGHTS_PER_RUN;
  board.nightLight = false;
  board.sync();
  shownScore = 0;
  $('#over').hidden = true;
  $('#intro').hidden = true;
  const coach = mode.kind === 'level' ? mode.def.coach : undefined;
  $('#coach').hidden = !coach;
  $('#coach').textContent = coach ?? '';
  $('#rule').hidden = !!coach;
  const theme = currentTheme();
  $('#rule').innerHTML = theme.words.rule;
  $('#night-label').textContent = theme.words.boost;
  document.body.dataset.art = theme.id;
  board.art = theme.art;
  board.words = theme.words;
  showScreen('play');
  renderHud();
}

function levelNumber(def: LevelDef): string {
  const inWorld = LEVELS.filter((l) => l.world === def.world);
  const world = worldOf(def);
  return `${world.name} · Level ${inWorld.indexOf(def) + 1}`;
}

function showIntro(def: LevelDef): void {
  $('#intro-world').textContent = levelNumber(def);
  $('#intro-title').textContent = def.name;
  const theme = themeById(worldOf(def).theme);
  $('#intro-goal').textContent = `${goalText(def.goal, theme.words)} in ${def.drops} drops`;
  // Show every cat size in play, with its hearts, so sizes are never a guess.
  const inPlay = new Set<number>([...(def.queue ?? []), ...(def.board ?? []).join('').split('').filter((ch) => ch >= '1' && ch <= '6').map(Number)]);
  const maxV = Math.max(def.maxValue ?? 0, ...inPlay);
  const sizes = Array.from({ length: maxV }, (_, i) => i + 1);
  $('#intro-sizes').innerHTML = sizes.map((v) => `<figure>${pieceImg(theme, v)}<figcaption>${v}${theme.art.unitSvg}</figcaption></figure>`).join('');
  $('#intro').hidden = false;
}

/* ---------- end of a game ---------- */

function showEnd(): void {
  const over = $('#over');
  const next = $('#over-next');
  const retry = $('#over-retry');
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (mode.kind === 'endless') {
    sfx.over();
    haptics.error();
    $('#over-stars').innerHTML = '';
    $('#over-title').textContent = 'The alley is full';
    $('#over-text').textContent = `Score ${fmt(game.score)} · Best ${fmt(best)} · Longest chain ×${game.longestChain}`;
    retry.textContent = 'Play again';
    retry.className = 'btn hot';
    next.hidden = true;
  } else {
    const { def } = mode;
    const res = levelResult(def, game);
    const nxt = nextLevel(def.id);
    if (game.won) {
      sfx.toggleChime();
      haptics.success();
      const had = progress[def.id] ?? 0;
      if (res.stars > had) {
        progress[def.id] = res.stars;
        void storage.set('progress', progress);
      }
      $('#over-stars').innerHTML = [1, 2, 3].map((n) => star(n <= res.stars, n <= res.stars ? 'earned' : '')).join('');
      $('#over-title').textContent = currentTheme().words.winTitle;
      $('#over-text').textContent =
        res.bonus > 0 ? `Score ${fmt(res.score)}, including +${fmt(res.bonus)} for ${game.dropsLeft} drops left` : `Score ${fmt(res.score)}`;
      retry.textContent = 'Replay';
      retry.className = 'btn';
      next.hidden = !nxt;
    } else {
      sfx.over();
      haptics.error();
      const p = goalProgress(def.goal, game);
      $('#over-stars').innerHTML = '';
      $('#over-title').textContent = game.endReason === 'full' ? 'The alley is full' : 'Out of drops';
      const left =
        def.goal.kind === 'clear'
          ? `${p.need - p.have} ${currentTheme().words.pieces} ${currentTheme().words.notCleared}`
          : def.goal.kind === 'score'
            ? `${fmt(game.score)} of ${fmt(def.goal.target)} points`
            : def.goal.kind === 'chain'
              ? `Longest chain ×${game.longestChain} of ×${def.goal.length}`
              : `${p.have} of ${p.need} ${currentTheme().words.cleared}`;
      $('#over-text').textContent = left;
      retry.textContent = 'Try again';
      retry.className = 'btn hot';
      next.hidden = true;
    }
  }
  over.hidden = false;
}

/* ---------- input ---------- */

const inputBlocked = () => !$('#intro').hidden || !$('#over').hidden;

async function drop(col: number): Promise<void> {
  if (board.busy || game.over || inputBlocked()) return;
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
  // A lit night light is used up by the drop it showed.
  if (board.nightLight) {
    board.nightLight = false;
    nightLights--;
  }
  renderHud();
  await board.play(out);
}

/* hold to preview, slide between columns, release to drop */
canvas.addEventListener('pointermove', (e) => {
  board.mouse = e.pointerType === 'mouse';
  board.hover = board.columnAt(e.clientX);
});
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') board.mouse = false;
});
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (board.hitsNext(e.clientX, e.clientY)) {
    swap();
    return;
  }
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

const replay = () => (mode.kind === 'level' ? startLevel(mode.def, false) : startEndless());
const toMap = () => {
  renderMap();
  showScreen('map');
};

$('#worlds').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.node');
  if (!btn || btn.disabled) return;
  sfx.unlock();
  const def = LEVELS.find((l) => l.id === btn.dataset.level);
  if (def) startLevel(def);
});
$('#endless').addEventListener('click', () => {
  sfx.unlock();
  startEndless();
});
$('#intro-play').addEventListener('click', () => {
  sfx.unlock();
  $('#intro').hidden = true;
});
$('#back').addEventListener('click', toMap);
$('#restart').addEventListener('click', replay);
$('#over-retry').addEventListener('click', replay);
$('#over-map').addEventListener('click', toMap);
$('#over-next').addEventListener('click', () => {
  if (mode.kind !== 'level') return;
  const nxt = nextLevel(mode.def.id);
  if (nxt) startLevel(nxt);
});
function swap(): void {
  if (board.busy || inputBlocked() || !game.swap()) return;
  sfx.unlock();
  sfx.drop();
  haptics.tap();
  board.swapped();
}
$('#swap').addEventListener('click', swap);
$('#night').addEventListener('click', () => {
  if (game.over || inputBlocked()) return;
  // Toggle: turning it on costs nothing until you drop; turning it off again is free.
  if (!board.nightLight && nightLights <= 0) return;
  board.nightLight = !board.nightLight;
  if (board.nightLight) {
    sfx.unlock();
    sfx.toggleChime();
  }
  renderTools();
});

$('#sound').addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  void storage.set('muted', sfx.muted);
  if (!sfx.muted) {
    sfx.unlock();
    sfx.toggleChime();
  }
  renderSound();
});

/* backdrop stars (fixed pattern, so it looks the same every launch) */
const starGroup = document.getElementById('stars');
if (starGroup) {
  starGroup.innerHTML = Array.from({ length: 36 }, (_, i) => {
    const x = (i * 97.3) % 400;
    const y = ((i * 53.7) % 120) + 6;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(i % 3) * 0.5 + 0.6}" opacity="${0.25 + (i % 4) * 0.12}"/>`;
  }).join('');
}

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
  if (!$('#play').hidden) board.draw(t, dt);
  requestAnimationFrame(frame);
}

async function boot(): Promise<void> {
  best = await storage.get('best', 0);
  sfx.muted = await storage.get('muted', false);
  progress = await storage.get<Record<string, number>>('progress', {});
  board.showHint = !(await storage.get('seenHint', false));
  renderMap();
  showScreen('map');
  requestAnimationFrame(frame);
}
void boot();

// Exposed for automated playtests and the balance script.
(window as unknown as { __sumdrop: unknown }).__sumdrop = {
  game,
  board,
  drop,
  startLevel: (id: string) => {
    const def = LEVELS.find((l) => l.id === id);
    if (def) startLevel(def, false);
  },
  startEndless,
  preview: (col: number) => previewDrop(game.grid, col, game.current),
};
