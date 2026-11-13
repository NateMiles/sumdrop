import { type Grid, type Wave, PREVIEW_ID, applyGravity, cloneGrid, neighborSum, previewDrop } from '../core/rules';
import type { DropOutcome, Game } from '../core/game';
import { palette } from './theme';
import { DEFAULT_THEME, moodFor, type Mood, type PieceArt, type ThemeWords } from '../themes';
import type { Sfx } from './audio';
import { haptics } from './platform';
import { warningWobble } from './warning';

const BANNER_WORDS = ['', '', 'Nice', 'Great', 'Awesome', 'Wild', 'Unreal'];

interface Vis { y: number; vy: number; fill: number; flash: number }
interface PopFx { v: number; r: number; c: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; col: string; s: number }
interface Geom { cell: number; x0: number; y0: number; bw: number; bh: number }

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export interface BoardCallbacks {
  onScore(delta: number): void;
  onSettled(): void;
}

/**
 * Draws the board and replays DropOutcomes as animation. Keeps its own copy of
 * the grid ("view") so it can show intermediate cascade states while the Game
 * already holds the final result.
 */
export class BoardView {
  hover = 2;
  pressing = false;
  mouse = false;
  busy = false;
  showHint = false;
  /** Night light boost: the preview also shows everything the drop would put to sleep. */
  nightLight = false;
  /** Swap animation progress, 1 → 0. */
  private swapFx = 0;
  private view: Grid;
  private vis = new Map<number, Vis>();
  private fx: PopFx[] = [];
  private parts: Particle[] = [];
  private floatText: { s: string; r: number; c: number; life: number } | null = null;
  private banner: { chain: number; life: number } | null = null;
  private shake = 0;
  /** Expanding rings where pieces clear. */
  private rings: { x: number; y: number; col: string; life: number }[] = [];
  /** Board tint pulse during chains, 1 → 0. */
  private chainTint = 0;
  /** Time the rise warning started, or -1 when it isn't showing. */
  private warnSince = -1;
  /** The current world's piece art and words. Set per level or mode. */
  art: PieceArt = DEFAULT_THEME.art;
  words: ThemeWords = DEFAULT_THEME.words;
  private w = 0;
  private h = 0;
  private ctx: CanvasRenderingContext2D;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    private sfx: Sfx,
    private cb: BoardCallbacks,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.view = cloneGrid(game.grid);
    this.resize();
  }

  /** Re-syncs with the game after a reset. */
  sync(): void {
    this.view = cloneGrid(this.game.grid);
    this.vis.clear();
    this.fx = [];
    this.parts = [];
    this.floatText = null;
    this.banner = null;
    this.rings = [];
    this.chainTint = 0;
    this.warnSince = -1;
    this.hover = Math.min(this.hover, this.game.cols - 1);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
  }

  geom(): Geom {
    const { cols, rows } = this.game;
    // Small (tutorial) boards get bigger cells, but not so big that they stop looking like the real board.
    const cell = Math.floor(Math.min((this.w - 20) / Math.max(cols, 5), (this.h - 20) / (rows + 1.4)));
    const bw = cell * cols;
    const bh = cell * rows;
    const x0 = (this.w - bw) / 2;
    const y0 = (this.h - bh - cell * 1.4) / 2 + cell * 1.4;
    return { cell, x0, y0, bw, bh };
  }

  columnAt(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const g = this.geom();
    return Math.max(0, Math.min(this.game.cols - 1, Math.floor((clientX - rect.left - g.x0) / g.cell)));
  }

  /** True when a client point is on the small "next" piece (tapping it swaps). */
  hitsNext(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const g = this.geom();
    const ns = g.cell * 0.5;
    const leftSide = this.hover >= this.game.cols - 2;
    const nx = leftSide ? g.x0 : g.x0 + g.bw - ns;
    const ny = g.y0 - g.cell * 1.3 + (g.cell - ns) / 2;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pad = g.cell * 0.25;
    return x >= nx - pad && x <= nx + ns + pad && y >= ny - pad && y <= ny + ns + pad;
  }

  /** Plays the swap animation (the game state has already swapped). */
  swapped(): void {
    this.swapFx = 1;
  }

  bump(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  private visOf(id: number, row: number): Vis {
    let v = this.vis.get(id);
    if (!v) {
      v = { y: row, vy: 0, fill: 0, flash: 0 };
      this.vis.set(id, v);
    }
    return v;
  }

  /* ---------- animation playback ---------- */

  async play(out: DropOutcome): Promise<void> {
    this.busy = true;
    const { tile, row, col } = out.placed;
    this.view[row][col] = { ...tile };
    this.vis.set(tile.id, { y: -1, vy: 0, fill: 0, flash: 0 });
    this.sfx.drop();
    haptics.tap();
    await wait(200);
    await this.playWaves(out.waves);
    if (out.rise) {
      const rows = this.game.rows;
      for (let r = 0; r < rows - 1; r++) this.view[r] = this.view[r + 1];
      this.view[rows - 1] = out.rise.row.map((t) => ({ ...t }));
      out.rise.row.forEach((t) => this.vis.set(t.id, { y: rows, vy: 0, fill: 0, flash: 0 }));
      this.sfx.rise();
      haptics.thud();
      this.bump(0.4);
      await wait(320);
      await this.playWaves(out.rise.waves);
    }
    // The view should now equal the game's grid; resync defensively.
    this.view = cloneGrid(this.game.grid);
    this.busy = false;
    this.cb.onSettled();
  }

  private async playWaves(waves: Wave[]): Promise<void> {
    for (const wave of waves) {
      for (const p of wave.popped) {
        const v = this.vis.get(p.tile.id);
        if (v) v.flash = 1;
      }
      // Chain steps get a beat of anticipation: the banner lands first, then they clear.
      if (wave.chain > 1) {
        this.banner = { chain: wave.chain, life: 1 };
        this.chainTint = 1;
      }
      await wait(wave.chain === 1 ? 140 : 320);
      wave.popped.forEach((p, i) => {
        this.view[p.r][p.c] = null;
        this.fx.push({ v: p.tile.v, r: p.r, c: p.c, life: 1 });
        this.rings.push({ x: p.c + 0.5, y: p.r + 0.5, col: this.art.color(p.tile.v), life: 1 });
        this.burst(p.r, p.c, p.tile.v);
        this.sfx.pop(wave.chain, i);
      });
      this.cb.onScore(wave.points);
      const first = wave.popped[0];
      this.floatText = { s: `+${wave.points}`, r: first.r, c: first.c, life: 1 };
      if (wave.chain > 1) this.bump(Math.min(1, 0.25 * wave.chain));
      haptics.pop(wave.chain);
      await wait(260);
      applyGravity(this.view);
      await wait(240);
    }
  }

  private burst(r: number, c: number, v: number): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.04 + Math.random() * 0.09;
      this.parts.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05, life: 1, col: this.art.color(v), s: 0.06 + Math.random() * 0.07 });
    }
  }

  /* ---------- drawing ---------- */

  draw(t: number, dt: number): void {
    const ctx = this.ctx;
    const g = this.geom();
    const game = this.game;
    ctx.clearRect(0, 0, this.w, this.h);
    if (g.cell <= 4) return; // not laid out yet
    let sx = 0;
    let sy = 0;
    if (this.shake > 0 && !this.reduced) {
      sx = Math.sin(t / 17) * 7 * this.shake;
      sy = Math.cos(t / 23) * 4 * this.shake;
    }
    this.shake = Math.max(0, this.shake - dt / 350);
    ctx.save();
    ctx.translate(sx, sy);

    const canPreview = !this.busy && !game.over && (this.mouse || this.pressing);
    const pv = canPreview ? previewDrop(game.grid, this.hover, game.current) : null;
    // The free preview shows the drop's direct effect: the warmth each touching piece
    // would gain, which pieces clear right away, and which slide down after. The night
    // light adds the rest of the chain, step by step.
    const waveOf = (id: number) => {
      const w = pv?.waveOf.get(id) ?? -1;
      return w === 0 || (w > 0 && this.nightLight) ? w : -1;
    };
    let pvGrid: Grid | null = null;
    if (pv) {
      pvGrid = cloneGrid(game.grid);
      pvGrid[pv.row][pv.col] = { id: PREVIEW_ID, v: game.current };
    }
    const isNeighborOfPreview = (r: number, c: number) => !!pv && Math.abs(r - pv.row) + Math.abs(c - pv.col) === 1;
    const pulse = 0.5 + 0.5 * Math.sin(t / 140);

    // board and columns
    rrect(ctx, g.x0 - 6, g.y0 - 6, g.bw + 12, g.bh + 12, 16);
    ctx.fillStyle = palette.board;
    ctx.fill();
    const { cols, rows } = game;
    for (let c = 0; c < cols; c++) {
      rrect(ctx, g.x0 + c * g.cell + 2, g.y0, g.cell - 4, g.bh, 10);
      ctx.fillStyle = !this.busy && !game.over && c === this.hover ? palette.columnHot : palette.column;
      ctx.fill();
    }
    ctx.strokeStyle = palette.dangerLine;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.x0, g.y0 + g.cell);
    ctx.lineTo(g.x0 + g.bw, g.y0 + g.cell);
    ctx.stroke();
    ctx.setLineDash([]);
    // Rise warning: one short shake when the warning starts, then a calm pulsing glow
    // along the bottom until the row rises (a constant jitter read as a bug).
    const danger = game.rising && game.untilRise === 1 && !game.over;
    if (danger && this.warnSince < 0) this.warnSince = t;
    if (!danger) this.warnSince = -1;
    const warnAge = danger ? t - this.warnSince : Infinity;
    if (danger) {
      const glow = 0.35 + 0.25 * Math.sin(t / 380);
      const gy = g.y0 + g.bh;
      const grad = ctx.createLinearGradient(0, gy - g.cell * 1.2, 0, gy + 6);
      grad.addColorStop(0, 'rgba(239,111,108,0)');
      grad.addColorStop(1, `rgba(239,111,108,${this.reduced ? 0.4 : glow})`);
      ctx.fillStyle = grad;
      ctx.fillRect(g.x0 - 6, gy - g.cell * 1.2, g.bw + 12, g.cell * 1.2 + 6);
    }

    // Chain tint: the board warms up for a moment on each chain step.
    this.chainTint = Math.max(0, this.chainTint - dt / 700);
    if (this.chainTint > 0 && !this.reduced) {
      rrect(ctx, g.x0 - 6, g.y0 - 6, g.bw + 12, g.bh + 12, 16);
      ctx.fillStyle = `rgba(255,210,122,${0.14 * this.chainTint})`;
      ctx.fill();
    }

    // tiles
    ctx.save();
    rrect(ctx, g.x0 - 6, g.y0 - 6, g.bw + 12, g.bh + 12, 16);
    ctx.clip();
    for (let r = 0; r < this.view.length; r++) {
      for (let c = 0; c < this.view[r].length; c++) {
        const tl = this.view[r][c];
        if (!tl) continue;
        const vs = this.visOf(tl.id, r);
        if (vs.y < r) {
          vs.vy += dt * 0.0072;
          vs.y = Math.min(r, vs.y + (vs.vy * dt) / 16);
          if (vs.y === r) vs.vy = 0;
        } else if (vs.y > r) {
          vs.y += (r - vs.y) * Math.min(1, dt / 60);
          if (Math.abs(vs.y - r) < 0.01) vs.y = r;
        }
        const sum = neighborSum(this.view, r, c);
        const over = sum > tl.v;
        vs.fill += ((over ? 1 : sum / tl.v) - vs.fill) * Math.min(1, dt / 90);
        vs.flash = Math.max(0, vs.flash - dt / 420);
        const wv = waveOf(tl.id);
        // Next to the previewed drop: show the warmth it would get, the new part glowing,
        // and a ring saying what happens (gold: clears, mint: warmer, red: too much).
        const touched = !!pvGrid && isNeighborOfPreview(r, c);
        const warmth = touched ? neighborSum(pvGrid!, r, c) : sum;
        let ring: string | null = null;
        if (touched && wv !== 0) ring = warmth > tl.v ? RING_OVER : RING_WARM;
        // Falling pieces leave a short trail so you can follow the cascade.
        if (vs.vy > 0.02 && !this.reduced) {
          for (const [k, a] of [[0.9, 0.22], [1.8, 0.1]] as const) {
            this.art.draw(ctx, g.x0 + c * g.cell, g.y0 + (vs.y - vs.vy * k) * g.cell, g.cell, tl.v, { ratio: vs.fill, base: false, alpha: a });
          }
        }
        drawPieceTile(ctx, this.art, g.x0 + c * g.cell, g.y0 + vs.y * g.cell, g.cell, tl.v, {
          warmth,
          warmthBefore: touched ? sum : undefined,
          ring,
          ringPulse: pulse,
          gain: touched ? `+${game.current}` : null,
          ratio: vs.fill,
          mood: moodFor(sum / tl.v),
          stripes: neighborValues(this.view, r, c),
          flash: vs.flash,
          // During playback, pieces about to clear light up gold (flash) before they go.
          glow: Math.max(vs.flash, wv === 0 ? 0.6 + 0.4 * pulse : wv > 0 ? 0.35 + 0.25 * pulse : 0),
          badge: wv > 0 ? `×${wv + 1}` : null,
          wobble: r === rows - 1 && !this.reduced ? warningWobble(warnAge, t, c) : 0,
        });
      }
    }
    if (pv) {
      // Slide arrows: where pieces fall after each visible step clears.
      pv.fallsByWave.forEach((falls, i) => {
        if (i > 0 && !this.nightLight) return;
        for (const f of falls) drawFallArrow(ctx, g.x0 + (f.c + 0.5) * g.cell, g.y0 + (f.fromRow + 0.5) * g.cell, g.y0 + (f.toRow + 0.5) * g.cell, g.cell, i, t);
      });
      const lf = pv.landingFill;
      const gw = waveOf(PREVIEW_ID);
      drawPieceTile(ctx, this.art, g.x0 + pv.col * g.cell, g.y0 + pv.row * g.cell, g.cell, game.current, {
        warmth: Math.round(lf * game.current),
        ratio: Math.min(1, lf),
        mood: moodFor(lf),
        stripes: neighborValues(game.grid, pv.row, pv.col),
        alpha: 0.7,
        glow: gw === 0 ? 0.6 + 0.4 * pulse : 0,
        badge: gw > 0 ? `×${gw + 1}` : null,
      });
      // Outline the landing spot so it is clear where the piece goes.
      ctx.save();
      rrect(ctx, g.x0 + pv.col * g.cell + 3, g.y0 + pv.row * g.cell + 3, g.cell - 6, g.cell - 6, g.cell * 0.2);
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t / 40;
      ctx.strokeStyle = 'rgba(251,243,234,.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // pop rings and particles
    this.fx = this.fx.filter((f) => (f.life -= dt / 700) > 0);
    for (const f of this.fx) {
      const x = g.x0 + f.c * g.cell;
      const y = g.y0 + f.r * g.cell;
      this.art.drawClearing(ctx, x, y, g.cell, f.v, 1 - f.life, this.reduced);
    }
    // Clear rings: expand and fade, in the piece's color.
    this.rings = this.rings.filter((rg) => (rg.life -= dt / 520) > 0);
    for (const rg of this.rings) {
      const k = 1 - rg.life;
      ctx.save();
      ctx.globalAlpha = rg.life;
      ctx.strokeStyle = rg.col;
      ctx.shadowColor = rg.col;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 7 * rg.life + 1.5;
      ctx.beginPath();
      ctx.arc(g.x0 + rg.x * g.cell, g.y0 + rg.y * g.cell, g.cell * (0.25 + k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    this.parts = this.parts.filter((p) => (p.life -= dt / 700) > 0);
    for (const p of this.parts) {
      p.x += (p.vx * dt) / 16;
      p.y += (p.vy * dt) / 16;
      p.vy += (0.004 * dt) / 16;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(g.x0 + p.x * g.cell, g.y0 + p.y * g.cell, g.cell * p.s * (0.5 + p.life * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // incoming tile, next tile, preview label
    if (!game.over) {
      const hx = g.x0 + this.hover * g.cell;
      const hy = g.y0 - g.cell * 1.3;
      const ns = g.cell * 0.5;
      const leftSide = this.hover >= cols - 2;
      const nx = leftSide ? g.x0 : g.x0 + g.bw - ns;
      const ny = hy + (g.cell - ns) / 2;
      // Swap animation: the two cats trade places along a short arc.
      this.swapFx = Math.max(0, this.swapFx - dt / 220);
      const k = this.reduced ? 0 : this.swapFx * this.swapFx;
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const lift = Math.sin(k * Math.PI) * g.cell * 0.35;
      this.art.draw(ctx, lerp(hx, nx), lerp(hy, ny) - lift, lerp(g.cell, ns), game.current, { ratio: 0, alpha: this.busy ? 0.45 : 1 });
      this.art.draw(ctx, lerp(nx, hx), lerp(ny, hy) + lift, lerp(ns, g.cell), game.next, { ratio: 0, alpha: 0.8 });
      ctx.fillStyle = palette.muted;
      ctx.font = `700 ${Math.max(10, g.cell * 0.17)}px Nunito, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = leftSide ? 'left' : 'right';
      ctx.fillText('NEXT', leftSide ? nx + ns + 6 : nx - 6, hy + g.cell / 2);
      const firstCount = pv ? [...pv.waveOf.values()].filter((w) => w === 0).length : 0;
      if (pv && firstCount) {
        const label =
          this.nightLight && pv.waves > 1
            ? `Chain ×${pv.waves}  +${pv.points}`
            : `${firstCount} ${this.words.cleared}${this.nightLight ? `  +${pv.points}` : ''}`;
        ctx.font = `800 ${g.cell * 0.3}px "Baloo 2", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const lx = Math.min(Math.max(hx + g.cell / 2, g.x0 + g.cell * 1.3), g.x0 + g.bw - g.cell * 1.3);
        outlinedText(ctx, label, lx, hy - g.cell * 0.05, 5, this.nightLight && pv.waves > 1 ? palette.coral : palette.gold);
      }
    }
    ctx.restore();

    // floating score
    if (this.floatText) {
      const ft = this.floatText;
      ft.life -= dt / 800;
      if (ft.life <= 0) this.floatText = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.min(1, ft.life * 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${g.cell * 0.42}px "Baloo 2", system-ui, sans-serif`;
        const x = g.x0 + (ft.c + 0.5) * g.cell;
        const y = g.y0 + (ft.r + 0.5) * g.cell - (1 - ft.life) * g.cell;
        outlinedText(ctx, ft.s, x, y, 5, palette.ink);
        ctx.restore();
      }
    }

    // chain banner
    if (this.banner) {
      const b = this.banner;
      b.life -= dt / 1100;
      if (b.life <= 0) this.banner = null;
      else {
        const pop = b.life > 0.85 ? 1 + (b.life - 0.85) * 3 : 1;
        const word = BANNER_WORDS[Math.min(b.chain, BANNER_WORDS.length - 1)];
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.life * 2.5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(this.w / 2, g.y0 + g.bh * 0.32);
        ctx.scale(pop, pop);
        ctx.rotate(-0.06);
        ctx.font = `800 ${g.cell}px "Baloo 2", system-ui, sans-serif`;
        outlinedText(ctx, `Chain ×${b.chain}`, 0, 0, 8, palette.coral);
        ctx.font = `800 ${g.cell * 0.45}px "Baloo 2", system-ui, sans-serif`;
        outlinedText(ctx, `${word}!`, 0, g.cell * 0.7, 6, palette.gold);
        ctx.restore();
      }
    }

    // first-run hint
    if (this.showHint && !game.over) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const msg = this.mouse ? this.words.mouseHint : 'Hold a column to preview. Let go to drop.';
      ctx.font = `700 ${Math.max(12, g.cell * 0.22)}px Nunito, system-ui, sans-serif`;
      const tw = ctx.measureText(msg).width + 24;
      const bx = this.w / 2;
      const by = g.y0 + g.bh * 0.45;
      rrect(ctx, bx - tw / 2, by - g.cell * 0.3, tw, g.cell * 0.6, 12);
      ctx.fillStyle = palette.hintBg;
      ctx.fill();
      ctx.fillStyle = palette.ink;
      ctx.fillText(msg, bx, by);
      ctx.restore();
    }
  }
}

/* ---------- drawing helpers ---------- */

const NEIGHBORS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, 0],
];

/** Values of the tiles touching (r, c), bottom first, so blanket stripes stack from the bottom up. */
function neighborValues(g: Grid, r: number, c: number): number[] {
  const out: number[] = [];
  for (const [dr, dc] of NEIGHBORS) {
    const t = g[r + dr]?.[c + dc];
    if (t) out.push(t.v);
  }
  return out;
}

const RING_WARM = '#8fd5b8';
const RING_OVER = '#ff5a5f';
const GLOW = '#ffd27a';

interface PieceTileOpts {
  ratio: number;
  warmth?: number;
  warmthBefore?: number;
  /** Colored ring for a piece the preview touches, and its "+N" gain tag. */
  ring?: string | null;
  ringPulse?: number;
  gain?: string | null;
  mood?: Mood;
  stripes?: number[];
  alpha?: number;
  glow?: number;
  badge?: string | null;
  flash?: number;
  wobble?: number;
  cushion?: boolean;
}

/** A piece plus the board's overlays: preview glow, cascade badge and clear flash. */
function drawPieceTile(ctx: CanvasRenderingContext2D, art: PieceArt, x: number, y: number, s: number, v: number, o: PieceTileOpts): void {
  const { glow = 0, badge = null, flash = 0, wobble = 0 } = o;
  if (glow > 0) {
    // Clears: a warm gold halo behind the piece and a bright outline in front.
    ctx.save();
    rrect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.2);
    ctx.fillStyle = `rgba(255,210,122,${0.16 + 0.14 * glow})`;
    ctx.shadowColor = GLOW;
    ctx.shadowBlur = 26 * glow;
    ctx.fill();
    ctx.restore();
  }
  art.draw(ctx, x + wobble, y, s, v, { ratio: o.ratio, mood: o.mood, neighbors: o.stripes, alpha: o.alpha, base: o.cushion, received: o.warmth, receivedBefore: o.warmthBefore });
  if (glow > 0) {
    ctx.save();
    rrect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.2);
    ctx.shadowColor = GLOW;
    ctx.shadowBlur = 18 * glow;
    ctx.strokeStyle = `rgba(255,226,160,${0.6 + 0.4 * glow})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }
  if (o.ring) {
    const p = o.ringPulse ?? 1;
    ctx.save();
    rrect(ctx, x + 3, y + 3, s - 6, s - 6, s * 0.2);
    ctx.shadowColor = o.ring;
    ctx.shadowBlur = 10 + 8 * p;
    ctx.strokeStyle = o.ring;
    ctx.globalAlpha = 0.65 + 0.35 * p;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  if (o.gain && (o.ring || glow > 0)) {
    // "+N" tag: how much warmth this piece would get from the drop.
    ctx.save();
    const col = o.ring ?? GLOW;
    ctx.font = `800 ${s * 0.22}px "Baloo 2", system-ui, sans-serif`;
    const tw = ctx.measureText(o.gain).width + s * 0.16;
    const th = s * 0.26;
    const tx = x + s * 0.04;
    const ty = y + s * 0.04;
    rrect(ctx, tx, ty, tw, th, th / 2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1d1838';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.gain, tx + tw / 2, ty + th / 2 + s * 0.01);
    ctx.restore();
  }
  if (flash > 0) {
    ctx.save();
    rrect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.2);
    ctx.fillStyle = `rgba(255,246,214,${flash * 0.6})`;
    ctx.fill();
    ctx.restore();
  }
  if (badge) {
    ctx.save();
    const bx = x + s - s * 0.12;
    const by = y + s * 0.14;
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = palette.coral;
    ctx.fill();
    ctx.fillStyle = palette.onCoral;
    ctx.font = `800 ${s * 0.2}px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, bx, by + s * 0.01);
    ctx.restore();
  }
}

/** Dashed arrow showing a piece sliding down after a step clears. Step 0 is white, later steps coral. */
function drawFallArrow(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, s: number, step: number, t: number): void {
  const col = step === 0 ? 'rgba(251,243,234,.9)' : 'rgba(239,111,108,.95)';
  const ox = s * 0.34;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(21,17,42,.9)';
  ctx.shadowBlur = 4;
  ctx.setLineDash([4, 5]);
  ctx.lineDashOffset = -t / 30;
  ctx.beginPath();
  ctx.moveTo(x + ox, y1);
  ctx.lineTo(x + ox, y2 - s * 0.12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x + ox - s * 0.13, y2 - s * 0.2);
  ctx.lineTo(x + ox + s * 0.13, y2 - s * 0.2);
  ctx.lineTo(x + ox, y2 - s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function outlinedText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, stroke: number, fill: string): void {
  ctx.lineWidth = stroke;
  ctx.strokeStyle = palette.outline;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}
