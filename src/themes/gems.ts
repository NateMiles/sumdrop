import type { Mood, PieceArt, PieceDrawOpts, Theme } from './types';

/**
 * Gem Grotto: the first world. Each gem's number of sides is its size, and that is
 * how many sparks it gives to every gem it touches (a round gem is 1, a lens 2, a
 * triangle 3, a square 4, a pentagon 5 and a hexagon 6).
 *
 * The gem itself shows its state, so the board reads at a glance:
 * - a fraction shows sparks it has over its size (2/4); exactly full (4/4) breaks it
 * - cracks spread and glow as it fills, so a nearly full gem looks ready to burst
 * - over full (5/4) it has too many: it turns dark red and is stuck until a neighbor leaves
 */

interface Cut {
  name: string;
  /** Main, light and dark tones. */
  base: string;
  light: string;
  dark: string;
}

const CUTS: Record<number, Cut> = {
  1: { name: 'round', base: '#3fd3b4', light: '#b8f5e6', dark: '#13836f' },
  2: { name: 'lens', base: '#4aa8f0', light: '#c3e4ff', dark: '#1d5ea8' },
  3: { name: 'triangle', base: '#9b7bf0', light: '#dccfff', dark: '#5233b0' },
  4: { name: 'square', base: '#f0679e', light: '#ffd0e2', dark: '#a8275c' },
  5: { name: 'pentagon', base: '#f5b33d', light: '#ffe9b8', dark: '#b06d0b' },
  6: { name: 'hexagon', base: '#e8454c', light: '#ffc4c4', dark: '#8f1520' },
};

const SPARK_LIT = '#fff6d6';
const SPARK_NEW = '#ffd27a';

const OVER_RED = '#ff4d5a';

/** Gem radius as a share of the cell: big enough to hold its number, bigger gems bigger. */
const gemRadius = (v: number) => 0.3 + (v - 1) * 0.026;

/** Outline points of a gem with `v` sides, centered at 0,0 with radius r. */
function outline(v: number, r: number): [number, number][] {
  if (v === 1) {
    return Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  }
  if (v === 2) {
    // A lens: two arcs meeting at a top and bottom point.
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      pts.push([Math.cos(a) * r * 0.72, Math.sin(a) * r * 1.08]);
    }
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI / 2 + (i / 12) * Math.PI;
      pts.push([Math.cos(a) * r * 0.72, Math.sin(a) * r * 1.08]);
    }
    return pts;
  }
  const rot = -Math.PI / 2 + (v === 4 ? Math.PI / 4 : 0);
  const k = v === 3 ? 1.12 : 1; // triangles look small at the same radius
  return Array.from({ length: v }, (_, i) => {
    const a = rot + (i / v) * Math.PI * 2;
    return [Math.cos(a) * r * k, Math.sin(a) * r * k + (v === 3 ? r * 0.18 : 0)];
  });
}

function path(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

interface GemLook {
  /** 0..1 how full: drives glow and how far the cracks have spread. */
  fill: number;
  mood: Mood;
  /** 0..1 pulse for a gem about to break. */
  pulse?: number;
}

/** Crack lines for a gem, from the rim toward the middle. Fixed per size so they don't flicker. */
const CRACKS = new Map<number, [number, number][][]>();
function cracksFor(v: number, r: number): [number, number][][] {
  let out = CRACKS.get(v);
  if (out) return out;
  let seed = v * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  out = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.4 + rnd() * 0.5;
    const pts: [number, number][] = [];
    const steps = 3;
    for (let k = 0; k <= steps; k++) {
      const d = r * (1.05 - (k / steps) * (0.55 + rnd() * 0.1));
      const j = k === 0 ? 0 : (rnd() - 0.5) * 0.5;
      pts.push([Math.cos(a + j) * d, Math.sin(a + j) * d]);
    }
    // a short branch off the middle
    const m = pts[1];
    const ba = a + (rnd() > 0.5 ? 0.9 : -0.9);
    pts.push([m[0] + Math.cos(ba) * r * 0.22, m[1] + Math.sin(ba) * r * 0.22]);
    return pts;
  });
  // Spread the order so the first cracks are on opposite sides.
  out = [0, 4, 2, 6, 1, 5, 3].map((i) => out![i]);
  CRACKS.set(v, out);
  return out;
}

/** Draws one gem centered at 0,0 in a 100-unit cell. */
function drawGem(ctx: CanvasRenderingContext2D, v: number, look: GemLook): void {
  const { mood } = look;
  const glow = Math.min(1, Math.max(0, look.fill));
  const over = mood === 'over';
  const c = CUTS[v];
  const r = gemRadius(v) * 100;
  const pts = outline(v, r);
  const facets = v <= 2 ? 1 : v;
  const pulse = look.pulse ?? 0.5;

  // Glow behind the gem grows as it fills; a nearly full gem throbs.
  if (!over && (glow > 0.05 || mood === 'done')) {
    ctx.save();
    ctx.shadowColor = c.light;
    ctx.shadowBlur = 4 + 20 * glow + (mood === 'close' ? 10 * pulse : 0);
    path(ctx, pts);
    ctx.fillStyle = c.base;
    ctx.fill();
    ctx.restore();
  }
  if (over) {
    ctx.save();
    ctx.shadowColor = OVER_RED;
    ctx.shadowBlur = 14;
    path(ctx, pts);
    ctx.fillStyle = OVER_RED;
    ctx.fill();
    ctx.restore();
  }

  // Body: diagonal gradient from light to dark. Empty gems are a little dull.
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, c.light);
  grad.addColorStop(0.45, c.base);
  grad.addColorStop(1, c.dark);
  path(ctx, pts);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  path(ctx, pts);
  ctx.clip();
  // Facets: an inner "table" and lines out to each corner.
  const inner = outline(v, r * 0.56).map(([x, y]) => [x, y - r * 0.04] as [number, number]);
  if (facets > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.stroke();
    }
  }
  path(ctx, inner);
  ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.22 * glow})`;
  ctx.fill();
  // Shine: a soft diagonal streak.
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.46, r * 0.3, r * 0.11, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fill();
  if (glow < 0.01 && !over) {
    // Nothing yet: a touch dull, so filling gems stand out.
    path(ctx, pts);
    ctx.fillStyle = 'rgba(14,20,44,.18)';
    ctx.fill();
  }
  if (over) {
    // Too many: dark and smoky red. Stuck until a neighbor leaves.
    path(ctx, pts);
    ctx.fillStyle = 'rgba(70,0,18,.55)';
    ctx.fill();
  }

  // Cracks spread as the gem fills: light leaks through them.
  const cracks = cracksFor(v, r);
  const shown = over ? cracks.length : glow <= 0 ? 0 : Math.max(1, Math.ceil(glow * cracks.length));
  if (shown) {
    const hot = mood === 'close' || mood === 'done';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < shown; i++) {
      const cr = cracks[i];
      ctx.beginPath();
      ctx.moveTo(cr[0][0], cr[0][1]);
      for (let k = 1; k < cr.length - 1; k++) ctx.lineTo(cr[k][0], cr[k][1]);
      ctx.moveTo(cr[1][0], cr[1][1]);
      ctx.lineTo(cr[cr.length - 1][0], cr[cr.length - 1][1]);
      if (over) {
        ctx.strokeStyle = 'rgba(20,0,6,.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = hot ? `rgba(255,248,220,${0.8 + 0.2 * pulse})` : 'rgba(255,250,235,.85)';
        ctx.shadowColor = hot ? SPARK_NEW : c.light;
        ctx.shadowBlur = hot ? 6 + 8 * pulse : 3;
        ctx.lineWidth = hot ? 3 : 2.2;
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  path(ctx, pts);
  ctx.lineWidth = over ? 3.4 : 2.2;
  ctx.strokeStyle = over ? OVER_RED : c.dark;
  ctx.stroke();
}

/**
 * The fraction in the middle of the gem: sparks it has / its size, like 2/4. At exactly
 * full it is gold (it breaks), over full it is red. In hand (no count yet) it shows
 * just the size, which is also what it gives. `fresh` marks a count changed by a preview.
 */
function drawCount(ctx: CanvasRenderingContext2D, v: number, got: number | undefined, fresh: boolean, bump: number): void {
  const k = 1 + 0.4 * bump;
  const over = got !== undefined && got > v;
  const full = got === v;
  const text = got === undefined ? String(v) : `${got}/${v}`;
  const base = got === undefined ? (v === 1 ? 32 : v === 2 ? 34 : 38) : v === 1 ? 22 : v === 2 ? 25 : got >= 10 ? 24 : 28;
  const size = base * k;
  ctx.save();
  ctx.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const y = (v === 3 ? 7 : 2) + size * 0.04;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = over ? '#3a0010' : 'rgba(16,14,40,.88)';
  ctx.strokeText(text, 0, y);
  ctx.fillStyle = over ? '#ffb3b8' : full || fresh ? SPARK_NEW : '#ffffff';
  if (full || fresh) {
    ctx.shadowColor = SPARK_NEW;
    ctx.shadowBlur = 10;
  }
  ctx.fillText(text, 0, y);
  ctx.restore();
}

/** Four-point sparkle, used for the need meter and the shatter effect. */
function sparkPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y);
  ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y);
  ctx.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s);
  ctx.closePath();
}

class GemArt implements PieceArt {
  readonly ready = Promise.resolve();
  private icons = new Map<number, string>();
  readonly unitSvg =
    '<svg viewBox="-6 -6 12 12" aria-hidden="true"><path d="M0 -5Q1 -1 5 0Q1 1 0 5Q-1 1 -5 0Q-1 -1 0 -5Z" fill="#ffd27a"/></svg>';

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, o: PieceDrawOpts = {}): void {
    if (!CUTS[v]) return;
    const ratio = o.ratio ?? 0;
    const mood = o.mood ?? 'idle';
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(size / 100, size / 100);
    drawGem(ctx, v, { fill: ratio, mood, pulse: o.pulse });
    if (o.number !== false) {
      const fresh = o.receivedBefore !== undefined && o.receivedBefore !== o.received;
      drawCount(ctx, v, o.received, fresh, o.bump ?? 0);
    }
    ctx.restore();
  }

  drawClearing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, k: number, reduced: boolean): void {
    // The gem flares, swells and breaks into light.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.globalAlpha = Math.max(0, 1 - k * 1.2);
    ctx.save();
    ctx.translate(50, 50);
    const sc = reduced ? 1 : 1 + k * 0.5;
    ctx.scale(sc, sc);
    drawGem(ctx, v, { fill: 1, mood: 'done', pulse: 1 });
    ctx.restore();
    if (!reduced) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = SPARK_LIT;
      ctx.shadowColor = CUTS[v].light;
      ctx.shadowBlur = 10;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k;
        const d = 18 + k * 46;
        sparkPath(ctx, 50 + Math.cos(a) * d, 50 + Math.sin(a) * d, 7 * (1 - k) + 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  color(v: number): string {
    return CUTS[v]?.base ?? '#d6d6e6';
  }

  iconUrl(v: number): string {
    let url = this.icons.get(v);
    if (!url) {
      // Render through a canvas so HTML icons match the board exactly.
      const cv = document.createElement('canvas');
      cv.width = cv.height = 160;
      const ctx = cv.getContext('2d')!;
      ctx.scale(1.6, 1.6);
      ctx.translate(50, 50);
      drawGem(ctx, v, { fill: 0.3, mood: 'idle' });
      url = cv.toDataURL('image/png');
      this.icons.set(v, url);
    }
    return url;
  }
}

export const gemTheme: Theme = {
  id: 'gems',
  art: new GemArt(),
  words: {
    pieces: 'gems',
    sizeNames: ['', 'round gems', 'lenses', 'triangles', 'squares', 'pentagons', 'hexagons'],
    clearVerb: 'Light up',
    cleared: 'lit up',
    notCleared: 'still dark',
    unit: 'spark',
    rule:
      '<b>Fill every gem exactly.</b> A gem shows sparks it has over sparks it needs, like 2/4. Each gem gives its own number to every gem it touches. Exactly full (4/4), it breaks. Over full (5/4), it turns red and waits for a neighbor to leave. Same gems break together.',
    mouseHint: 'Hover a column to preview where your gem lands.',
    boost: 'Lantern',
    winTitle: 'Brilliant!',
  },
};
