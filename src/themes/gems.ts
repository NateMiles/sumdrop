import type { Mood, PieceArt, PieceDrawOpts, Theme } from './types';

/**
 * Gem Grotto: the first world. Each gem's number of sides is its size, so the
 * shape itself says how much it needs: a round gem is 1, a lens 2, a triangle
 * 3, a square 4, a pentagon 5 and a hexagon 6. Bigger gems are also drawn bigger.
 * Need is shown as sparks on the gem's stand; a full gem shatters into light.
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
const SPARK_HOT = '#ff5a5f';
const SPARK_DARK = 'rgba(10,20,40,.55)';

/** Gem radius as a share of the cell: the hexagon is about twice the round gem. */
const gemRadius = (v: number) => 0.2 + (v - 1) * 0.034;

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

/** Draws one gem centered at 0,0 in a 100-unit cell. `glow` 0..1 brightens it as it fills. */
function drawGem(ctx: CanvasRenderingContext2D, v: number, glow: number, mood: Mood): void {
  const c = CUTS[v];
  const r = gemRadius(v) * 100;
  const pts = outline(v, r);
  const facets = v <= 2 ? 1 : v;

  // Glow behind the gem grows as it fills; a full gem blazes.
  if (glow > 0.05 || mood === 'done') {
    ctx.save();
    ctx.shadowColor = mood === 'over' ? SPARK_HOT : c.light;
    ctx.shadowBlur = 6 + 22 * (mood === 'done' ? 1 : glow);
    path(ctx, pts);
    ctx.fillStyle = c.base;
    ctx.fill();
    ctx.restore();
  }

  // Body: diagonal gradient from light to dark.
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, c.light);
  grad.addColorStop(0.45, c.base);
  grad.addColorStop(1, c.dark);
  path(ctx, pts);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = c.dark;
  ctx.stroke();

  // Facets: an inner "table" and lines out to each corner.
  const inner = outline(v, r * 0.52).map(([x, y]) => [x, y - r * 0.06] as [number, number]);
  ctx.save();
  path(ctx, pts);
  ctx.clip();
  if (facets > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.stroke();
    }
  }
  path(ctx, inner);
  ctx.fillStyle = `rgba(255,255,255,${0.16 + 0.3 * glow})`;
  ctx.fill();
  // Shine: a soft diagonal streak.
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.34, r * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fill();
  if (mood === 'over') {
    // Too much: a red wash and a crack.
    ctx.fillStyle = 'rgba(255,60,70,.28)';
    ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    ctx.strokeStyle = 'rgba(40,0,10,.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.7);
    ctx.lineTo(-r * 0.12, -r * 0.15);
    ctx.lineTo(r * 0.16, r * 0.1);
    ctx.lineTo(-r * 0.05, r * 0.6);
    ctx.stroke();
  }
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
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);

    if (o.base !== false) this.drawStand(ctx, v, o);

    ctx.save();
    ctx.translate(50, 44);
    drawGem(ctx, v, Math.min(1, Math.max(0, ratio)), mood);
    ctx.restore();
    ctx.restore();
  }

  /** The stand under the gem holds its sparks: lit for received, dark for still needed. */
  private drawStand(ctx: CanvasRenderingContext2D, v: number, o: PieceDrawOpts): void {
    const c = CUTS[v];
    ctx.fillStyle = 'rgba(10,20,40,.55)';
    roundRect(ctx, 8, 84, 84, 15, 7.5);
    ctx.fill();
    ctx.strokeStyle = c.base;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    const w = o.received;
    const hot = w !== undefined && w > v;
    const gap = v >= 6 ? 13.2 : 14.8;
    for (let i = 0; i < v; i++) {
      const lit = w === undefined || hot || i < w;
      const isNew = !hot && w !== undefined && o.receivedBefore !== undefined && i >= o.receivedBefore && i < w;
      const sx = 50 + (i - (v - 1) / 2) * gap;
      ctx.save();
      sparkPath(ctx, sx, 91.5, v >= 6 ? 6.4 : 7);
      if (hot) {
        ctx.fillStyle = SPARK_HOT;
        ctx.shadowColor = SPARK_HOT;
        ctx.shadowBlur = 6;
      } else if (isNew) {
        ctx.fillStyle = SPARK_NEW;
        ctx.shadowColor = SPARK_NEW;
        ctx.shadowBlur = 9;
      } else if (lit) {
        ctx.fillStyle = w === undefined ? c.light : SPARK_LIT;
        if (w !== undefined) {
          ctx.shadowColor = SPARK_LIT;
          ctx.shadowBlur = 5;
        }
      } else {
        ctx.fillStyle = SPARK_DARK;
      }
      ctx.fill();
      if (!lit) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawClearing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, k: number, reduced: boolean): void {
    // The gem flares, swells and breaks into light.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    ctx.globalAlpha = Math.max(0, 1 - k * 1.2);
    ctx.save();
    ctx.translate(50, 44);
    const sc = reduced ? 1 : 1 + k * 0.5;
    ctx.scale(sc, sc);
    drawGem(ctx, v, 1, 'done');
    ctx.restore();
    if (!reduced) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = SPARK_LIT;
      ctx.shadowColor = CUTS[v].light;
      ctx.shadowBlur = 10;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k;
        const d = 18 + k * 46;
        sparkPath(ctx, 50 + Math.cos(a) * d, 44 + Math.sin(a) * d, 7 * (1 - k) + 2);
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
      drawGem(ctx, v, 0.4, 'idle');
      url = cv.toDataURL('image/png');
      this.icons.set(v, url);
    }
    return url;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
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
      '<b>Light every spark.</b> A gem needs one spark per side. Each touching gem gives as many sparks as it has sides. All lit, it shatters into light. Too many and they turn red. Same gems shatter together.',
    mouseHint: 'Hover a column to preview where your gem lands.',
    boost: 'Lantern',
    winTitle: 'Brilliant!',
  },
};
