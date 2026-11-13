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
      stripes: o.neighbors,
      face: o.mood ? FACE[o.mood] : undefined,
      cushion: o.base,
      alpha: o.alpha,
    });
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
      '<b>Fill every heart.</b> Each cat touching a cat fills as many of its hearts as it has. All hearts filled, it falls asleep. Too many and the hearts turn red. Same-colored cats nap together.',
    mouseHint: 'Hover a column to preview where your cat lands.',
    winTitle: 'Sweet dreams!',
  },
};
