import { COLS, ROWS, type Grid, type Wave, PREVIEW_ID, applyGravity, cloneGrid, neighborSum, previewDrop } from '../core/rules';
import type { DropOutcome, Game } from '../core/game';
import { palette, tileColor } from './theme';
import type { Sfx } from './audio';
import { haptics } from './platform';

const PIPS: Record<number, ReadonlyArray<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
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
  private view: Grid;
  private vis = new Map<number, Vis>();
  private fx: PopFx[] = [];
  private parts: Particle[] = [];
  private floatText: { s: string; r: number; c: number; life: number } | null = null;
  private banner: { chain: number; life: number } | null = null;
  private shake = 0;
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
    const cell = Math.floor(Math.min((this.w - 20) / COLS, (this.h - 20) / (ROWS + 1.4)));
    const bw = cell * COLS;
    const bh = cell * ROWS;
    const x0 = (this.w - bw) / 2;
    const y0 = (this.h - bh - cell * 1.4) / 2 + cell * 1.4;
    return { cell, x0, y0, bw, bh };
  }

  columnAt(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    const g = this.geom();
    return Math.max(0, Math.min(COLS - 1, Math.floor((clientX - rect.left - g.x0) / g.cell)));
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
      for (let r = 0; r < ROWS - 1; r++) this.view[r] = this.view[r + 1];
      this.view[ROWS - 1] = out.rise.row.map((t) => ({ ...t }));
      out.rise.row.forEach((t) => this.vis.set(t.id, { y: ROWS, vy: 0, fill: 0, flash: 0 }));
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
      await wait(wave.chain === 1 ? 90 : 160);
      wave.popped.forEach((p, i) => {
        this.view[p.r][p.c] = null;
        this.fx.push({ v: p.tile.v, r: p.r, c: p.c, life: 1 });
        this.burst(p.r, p.c, p.tile.v);
        this.sfx.pop(wave.chain, i);
      });
      this.cb.onScore(wave.points);
      const first = wave.popped[0];
      this.floatText = { s: `+${wave.points}`, r: first.r, c: first.c, life: 1 };
      if (wave.chain > 1) {
        this.banner = { chain: wave.chain, life: 1 };
        this.bump(Math.min(1, 0.25 * wave.chain));
      }
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
      this.parts.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05, life: 1, col: tileColor(v), s: 0.06 + Math.random() * 0.07 });
    }
  }

  /* ---------- drawing ---------- */

  draw(t: number, dt: number): void {
    const ctx = this.ctx;
    const g = this.geom();
    const game = this.game;
    ctx.clearRect(0, 0, this.w, this.h);
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
    const waveOf = (id: number) => pv?.waveOf.get(id) ?? -1;
    const pulse = 0.5 + 0.5 * Math.sin(t / 140);

    // board and columns
    rrect(ctx, g.x0 - 6, g.y0 - 6, g.bw + 12, g.bh + 12, 16);
    ctx.fillStyle = palette.board;
    ctx.fill();
    for (let c = 0; c < COLS; c++) {
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
    const danger = game.untilRise === 1 && !game.over;

    // tiles
    ctx.save();
    rrect(ctx, g.x0 - 6, g.y0 - 6, g.bw + 12, g.bh + 12, 16);
    ctx.clip();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
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
        vs.flash = Math.max(0, vs.flash - dt / 200);
        const wv = waveOf(tl.id);
        drawTile(ctx, g.x0 + c * g.cell, g.y0 + vs.y * g.cell, g.cell, tl.v, {
          fill: vs.fill,
          over,
          t,
          flash: vs.flash,
          glow: wv === 0 ? 0.5 + 0.5 * pulse : 0,
          badge: wv > 0 ? `×${wv + 1}` : null,
          wobble: danger && r === ROWS - 1 && !this.reduced ? Math.sin(t / 40 + c) * 1.2 : 0,
        });
      }
    }
    if (pv) {
      const lf = pv.landingFill;
      const gw = waveOf(PREVIEW_ID);
      drawTile(ctx, g.x0 + pv.col * g.cell, g.y0 + pv.row * g.cell, g.cell, game.current, {
        fill: Math.min(1, lf),
        over: lf > 1,
        t,
        alpha: 0.55,
        glow: gw === 0 ? pulse : 0,
        badge: gw > 0 ? `×${gw + 1}` : null,
      });
    }
    ctx.restore();

    // pop rings and particles
    this.fx = this.fx.filter((f) => (f.life -= dt / 320) > 0);
    for (const f of this.fx) {
      const x = g.x0 + f.c * g.cell;
      const y = g.y0 + f.r * g.cell;
      const k = 1 - f.life;
      drawTile(ctx, x, y, g.cell, f.v, { fill: 1, scale: 1 + k * 0.4, alpha: f.life, t });
      ctx.beginPath();
      ctx.arc(x + g.cell / 2, y + g.cell / 2, g.cell * (0.4 + k * 1.1), 0, Math.PI * 2);
      ctx.strokeStyle = tileColor(f.v);
      ctx.globalAlpha = f.life;
      ctx.lineWidth = 4 * f.life;
      ctx.stroke();
      ctx.globalAlpha = 1;
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
      drawTile(ctx, hx, hy, g.cell, game.current, { t, alpha: this.busy ? 0.45 : 1, scale: this.busy ? 0.85 : 1 });
      const ns = g.cell * 0.5;
      const leftSide = this.hover >= COLS - 2;
      const nx = leftSide ? g.x0 : g.x0 + g.bw - ns;
      drawTile(ctx, nx, hy + (g.cell - ns) / 2, ns, game.next, { t, alpha: 0.7 });
      ctx.fillStyle = palette.muted;
      ctx.font = `700 ${Math.max(10, g.cell * 0.17)}px Nunito, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = leftSide ? 'left' : 'right';
      ctx.fillText('NEXT', leftSide ? nx + ns + 6 : nx - 6, hy + g.cell / 2);
      if (pv && pv.waves) {
        const label = pv.waves > 1 ? `Chain ×${pv.waves}  +${pv.points}` : `Pop!  +${pv.points}`;
        ctx.font = `800 ${g.cell * 0.3}px "Baloo 2", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const lx = Math.min(Math.max(hx + g.cell / 2, g.x0 + g.cell * 1.3), g.x0 + g.bw - g.cell * 1.3);
        outlinedText(ctx, label, lx, hy - g.cell * 0.05, 5, pv.waves > 1 ? palette.coral : palette.ink);
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
      const msg = this.mouse ? 'Hover a column to preview. Glowing tiles will pop.' : 'Hold a column to preview. Let go to drop.';
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

interface TileOpts {
  fill?: number;
  over?: boolean;
  alpha?: number;
  scale?: number;
  glow?: number;
  badge?: string | null;
  t?: number;
  flash?: number;
  wobble?: number;
}

/** A die whose shell fills with liquid as its neighbors' dots pour in. Exactly full pops; overfull spills. */
export function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, v: number, o: TileOpts = {}): void {
  const { fill = 0, over = false, alpha = 1, scale = 1, glow = 0, badge = null, t = 0, flash = 0, wobble = 0 } = o;
  const color = tileColor(v);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + s / 2 + wobble, y + s / 2);
  ctx.scale(scale, scale);
  const sz = s * 0.88;
  const half = sz / 2;
  const rad = s * 0.22;

  rrect(ctx, -half, -half + 3, sz, sz, rad);
  ctx.fillStyle = palette.tileShadow;
  ctx.fill();

  rrect(ctx, -half, -half, sz, sz, rad);
  ctx.fillStyle = palette.tileShell;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = alpha * (over ? 0.75 : 0.28);
  ctx.fillStyle = color;
  ctx.fillRect(-half, -half, sz, sz);
  ctx.globalAlpha = alpha;
  if (fill > 0.001 && !over) {
    const top = half - sz * Math.min(1, fill);
    const amp = fill < 0.99 ? s * 0.025 : 0;
    ctx.beginPath();
    ctx.moveTo(-half, half);
    for (let i = 0; i <= 12; i++) {
      const xx = -half + (sz * i) / 12;
      ctx.lineTo(xx, top + Math.sin(t / 260 + i * 0.8 + x * 0.05) * amp);
    }
    ctx.lineTo(half, half);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();

  if (over) {
    ctx.fillStyle = color;
    for (const dx of [-0.45, 0.1, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(dx * half, -half + s * 0.02, s * 0.06, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  rrect(ctx, -half, -half, sz, sz, rad);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * 0.55;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = alpha;

  const pr = s * 0.075;
  const gap = s * 0.22;
  ctx.fillStyle = over ? palette.pipDim : palette.pip;
  for (const [px, py] of PIPS[v] ?? []) {
    ctx.beginPath();
    ctx.arc(px * gap, py * gap, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (glow > 0) {
    rrect(ctx, -half - 2, -half - 2, sz + 4, sz + 4, rad + 2);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 16 * glow;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * glow})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (flash > 0) {
    rrect(ctx, -half, -half, sz, sz, rad);
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fill();
  }
  if (badge) {
    const bx = half - s * 0.04;
    const by = -half + s * 0.04;
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = palette.coral;
    ctx.fill();
    ctx.fillStyle = palette.onCoral;
    ctx.font = `800 ${s * 0.2}px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, bx, by + s * 0.01);
  }
  ctx.restore();
}
