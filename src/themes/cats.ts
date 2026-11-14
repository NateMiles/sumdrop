import { CatSprites, catBodySvg, drawCat, familyColor, type Face } from '../ui/cats';
import type { Mood, PieceArt, PieceDrawOpts, Theme } from './types';

const FACE: Record<Mood, Face> = { idle: 'awake', close: 'drowsy', done: 'asleep', over: 'grumpy' };

class CatArt implements PieceArt {
  private sprites = new CatSprites();
  readonly ready = this.sprites.ready;
  private icons = new Map<number, string>();
  readonly unitSvg = `<svg viewBox="-6 -6 12 10" aria-hidden="true"><path d="M0 3.2C-3.6 0.4 -5 -1.2 -5 -2.8C-5 -4.4 -3.8 -5.4 -2.5 -5.4C-1.4 -5.4 -0.5 -4.8 0 -4C0.5 -4.8 1.4 -5.4 2.5 -5.4C3.8 -5.4 5 -4.4 5 -2.8C5 -1.2 3.6 0.4 0 3.2Z" fill="#ef6f6c"/></svg>`;

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, o: PieceDrawOpts = {}): void {
    drawCat(ctx, this.sprites, x, y, size, v, {
      ratio: o.ratio,
      warmth: o.received,
      gainFrom: o.receivedBefore,
      stripes: o.neighbors,
      face: o.mood ? FACE[o.mood] : undefined,
      cushion: o.base,
      alpha: o.alpha,
    });
    if (o.number !== false) drawNeedBubble(ctx, x, y, size, v, o);
  }

  drawClearing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, k: number, reduced: boolean): void {
    // The cat dozes off and drifts up out of its cushion.
    const drift = reduced ? 0 : k * k * size * 1.1;
    drawCat(ctx, this.sprites, x + Math.sin(k * 6) * size * 0.04, y - drift, size, v, { face: 'asleep', ratio: 1, cushion: false, alpha: 1 - k });
  }

  color(v: number): string {
    return familyColor(v);
  }

  iconUrl(v: number): string {
    let url = this.icons.get(v);
    if (!url) {
      url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(catBodySvg(v, 'awake'));
      this.icons.set(v, url);
    }
    return url;
  }
}

/** Cat Nap Alley: cats on cushions, hearts as need, falling asleep as clearing. */
export const catTheme: Theme = {
  id: 'cats',
  art: new CatArt(),
  words: {
    pieces: 'cats',
    sizeNames: ['', 'kittens', 'gingers', 'blues', 'siamese', 'calicos', 'chonks'],
    clearVerb: 'Tuck in',
    cleared: 'tucked in',
    notCleared: 'still awake',
    unit: 'heart',
    rule:
      '<b>Warm every cat exactly.</b> The bubble shows hearts a cat has over hearts it needs, like 2/4. Each cat gives its own number to every cat it touches. Exactly full (4/4), it falls asleep. Over full (5/4), it is too warm and waits for a neighbor to leave. Same-colored cats nap together.',
    mouseHint: 'Hover a column to preview where your cat lands.',
    boost: 'Night light',
    winTitle: 'Sweet dreams!',
  },
};

/**
 * Hearts it has over hearts it needs, in a pill on the cat's corner (2/4). Exactly full
 * is gold (asleep); over full is red (too warm). In hand it shows just the size.
 */
function drawNeedBubble(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, o: PieceDrawOpts): void {
  const got = o.received;
  const fresh = o.receivedBefore !== undefined && o.receivedBefore !== got;
  const over = got !== undefined && got > v;
  const text = got === undefined ? String(v) : `${got}/${v}`;
  const k = 1 + 0.3 * (o.bump ?? 0);
  const h = size * 0.27 * k;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `800 ${h * 0.78}px "Baloo 2", system-ui, sans-serif`;
  const w = Math.max(h, ctx.measureText(text).width + h * 0.5);
  const cx = Math.min(x + size * 0.83, x + size - w / 2 - 1);
  const cy = y + size * 0.16;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  else ctx.rect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = over ? '#ef3f4c' : got === v || fresh ? '#ffd27a' : '#fbf3ea';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1d1838';
  ctx.stroke();
  ctx.fillStyle = over ? '#fff' : '#1d1838';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + h * 0.06);
  ctx.restore();
}
