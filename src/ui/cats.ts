/**
 * Cat Nap Alley tile art.
 *
 * Each tile is a cat on a cushion. The cat's size and the hearts on its cushion
 * show its value. A knitted blanket rises as neighbors share warmth: each
 * neighbor adds a stripe in its own color, as thick as its share of this cat's
 * hearts. Tucked to the chin, the cat falls asleep; past that, it gets too warm.
 *
 * The cat body (with its face) is an SVG sprite, one per value and face. The
 * blanket, stripes, paws and cushion are drawn live on the canvas because they
 * change continuously.
 */

export type Face = 'awake' | 'drowsy' | 'asleep' | 'grumpy';
export const FACES: readonly Face[] = ['awake', 'drowsy', 'asleep', 'grumpy'];

interface Family {
  name: string;
  coat: string;
  shade: string;
  belly: string;
  blanket: string;
  knit: string;
  eye: string;
  eyeColor?: string;
  pattern: 'none' | 'stripes' | 'points' | 'calico';
  point?: string;
  dark?: boolean;
}

export const FAMILIES: Record<number, Family> = {
  1: { name: 'Kitten', coat: '#f6c59a', shade: '#e3a77a', belly: '#fde7d2', blanket: '#8fd5b8', knit: '#6fbf9e', eye: '#2a2140', pattern: 'none' },
  2: { name: 'Ginger', coat: '#ef9450', shade: '#d4743a', belly: '#fbd9b5', blanket: '#8ec5f0', knit: '#6aa9dc', eye: '#2a2140', pattern: 'stripes' },
  3: { name: 'Blue', coat: '#93a6c9', shade: '#7489b0', belly: '#c9d4ea', blanket: '#b9a2e8', knit: '#9b82d6', eye: '#2a2140', pattern: 'none', eyeColor: '#9fd8a0' },
  4: { name: 'Siamese', coat: '#efe2d6', shade: '#d5c3b4', belly: '#fbf5ef', blanket: '#f29bb5', knit: '#e07899', eye: '#2a2140', pattern: 'points', point: '#7c6a8a', eyeColor: '#7fb6f0' },
  5: { name: 'Calico', coat: '#f7efe6', shade: '#e2d4c6', belly: '#ffffff', blanket: '#f7b955', knit: '#e39b2f', eye: '#2a2140', pattern: 'calico' },
  6: { name: 'Chonk', coat: '#3a3150', shade: '#2a2340', belly: '#4d4366', blanket: '#ef6f6c', knit: '#d4504f', eye: '#2a2140', pattern: 'none', eyeColor: '#ffcf5a', dark: true },
};

export const familyColor = (v: number): string => FAMILIES[v]?.blanket ?? '#d6d6e6';

/** Kitten 0.36 → chonk 0.72 of the cell: the chonk is twice the kitten. */
export const catScale = (v: number): number => 0.36 + (v - 1) * 0.072;

/** Which face a cat shows for a given fill ratio (neighbor warmth / own hearts). */
export function faceFor(ratio: number): Face {
  if (ratio > 1) return 'grumpy';
  if (ratio === 1) return 'asleep';
  return ratio >= 0.6 ? 'drowsy' : 'awake';
}

/* ---------- SVG sprite for the body and face ---------- */

export function catBodySvg(v: number, face: Face): string {
  const f = FAMILIES[v];
  const s = catScale(v);
  const ink = f.dark ? '#ffcf5a' : f.eye;
  const ear = face === 'grumpy' ? 10 : 0;
  let eyes = '';
  if (face === 'asleep') {
    eyes = `<path d="M-17 -21q6 5 12 0M5 -21q6 5 12 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  } else if (face === 'grumpy') {
    eyes = `<path d="M-18 -26l10 5l-10 4M18 -26l-10 5l10 4" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    const ec = f.eyeColor;
    const pupils = ec
      ? `<ellipse cx="-12" cy="-22" rx="5.5" ry="6.5" fill="${ec}"/><ellipse cx="12" cy="-22" rx="5.5" ry="6.5" fill="${ec}"/><ellipse cx="-12" cy="-22" rx="2" ry="5" fill="#1b1528"/><ellipse cx="12" cy="-22" rx="2" ry="5" fill="#1b1528"/>`
      : `<ellipse cx="-12" cy="-22" rx="5" ry="6" fill="${f.eye}"/><ellipse cx="12" cy="-22" rx="5" ry="6" fill="${f.eye}"/>`;
    const lidColor = f.pattern === 'points' ? f.point : f.coat;
    const lids = face === 'drowsy' ? `<rect x="-19" y="-30" width="14" height="8" fill="${lidColor}"/><rect x="5" y="-30" width="14" height="8" fill="${lidColor}"/>` : '';
    eyes = `${pupils}<circle cx="-10" cy="-24.5" r="1.8" fill="#fff"/><circle cx="14" cy="-24.5" r="1.8" fill="#fff"/>${lids}`;
  }
  const mouth =
    face === 'grumpy'
      ? `<path d="M-5 -6q5 -4 10 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`
      : `<path d="M-5 -9q2.5 3 5 0q2.5 3 5 0" fill="none" stroke="${f.dark ? '#c9b8e0' : f.eye}" stroke-width="2" stroke-linecap="round"/>`;
  const blushColor = face === 'grumpy' ? '#ff5a6a' : '#ff9fb0';
  const blushOpacity = face === 'grumpy' ? 0.85 : face === 'awake' ? 0 : 0.6;
  const blush = blushOpacity
    ? `<ellipse cx="-20" cy="-12" rx="5" ry="3" fill="${blushColor}" opacity="${blushOpacity}"/><ellipse cx="20" cy="-12" rx="5" ry="3" fill="${blushColor}" opacity="${blushOpacity}"/>`
    : '';
  let pattern = '';
  if (f.pattern === 'stripes')
    pattern = `<path d="M-6 -46q6 -3 12 0M-9 -40q9 -3 18 0" fill="none" stroke="${f.shade}" stroke-width="3.5" stroke-linecap="round"/><path d="M-38 6q8 -2 12 4M38 6q-8 -2 -12 4" fill="none" stroke="${f.shade}" stroke-width="4" stroke-linecap="round"/>`;
  if (f.pattern === 'calico')
    pattern = `<path d="M-30 -36q10 -14 22 -8q-4 10 -18 14z" fill="#f2a253"/><path d="M14 -44q14 0 16 14q-10 2 -18 -6z" fill="#3d3346"/><path d="M18 2q14 -6 22 6q-4 12 -18 8z" fill="#f2a253"/>`;
  const points = f.pattern === 'points' ? `<ellipse cx="0" cy="-17" rx="17" ry="13" fill="${f.point}" opacity=".55"/>` : '';
  const earFill = f.pattern === 'points' ? f.point : f.coat;
  const steam =
    face === 'grumpy'
      ? `<g fill="#ffd9cc" opacity=".9"><circle cx="-40" cy="-58" r="5"/><circle cx="-47" cy="-66" r="3.5"/><circle cx="40" cy="-58" r="5"/><circle cx="47" cy="-66" r="3.5"/></g>`
      : '';
  const zz =
    face === 'asleep'
      ? `<g fill="${f.dark ? '#ffcf5a' : '#fbf3ea'}" font-family="Baloo 2, Trebuchet MS, sans-serif" font-weight="800"><text x="26" y="-48" font-size="15">z</text><text x="38" y="-62" font-size="11">z</text></g>`
      : '';
  const body = `
    <path d="M30 30 C 58 30 56 2 44 -4" fill="none" stroke="${f.shade}" stroke-width="11" stroke-linecap="round"/>
    <rect x="-40" y="-20" width="80" height="58" rx="30" fill="${f.coat}"/>
    <ellipse cx="0" cy="18" rx="24" ry="18" fill="${f.belly}" opacity=".9"/>
    <g transform="rotate(${-ear} -22 -40)"><path d="M-30 -36 L-28 -62 L-8 -46 Z" fill="${earFill}" stroke="${earFill}" stroke-width="7" stroke-linejoin="round"/><path d="M-25 -42 L-24 -54 L-14 -46 Z" fill="#f4a9b8"/></g>
    <g transform="rotate(${ear} 22 -40)"><path d="M30 -36 L28 -62 L8 -46 Z" fill="${earFill}" stroke="${earFill}" stroke-width="7" stroke-linejoin="round"/><path d="M25 -42 L24 -54 L14 -46 Z" fill="#f4a9b8"/></g>
    <ellipse cx="0" cy="-24" rx="32" ry="27" fill="${f.coat}"/>
    ${pattern}${points}${blush}${eyes}
    <path d="M-3 -14h6l-3 3.5z" fill="#f0889a"/>${mouth}${steam}${zz}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><g transform="translate(47 ${87 - 46 * s}) scale(${s})">${body}</g></svg>`;
}

/* ---------- sprite cache ---------- */

export class CatSprites {
  private images = new Map<string, HTMLImageElement>();
  readonly ready: Promise<void>;

  constructor() {
    const loads: Promise<void>[] = [];
    for (let v = 1; v <= 6; v++) {
      for (const face of FACES) {
        const img = new Image();
        img.decoding = 'async';
        loads.push(
          new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
        );
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(catBodySvg(v, face));
        this.images.set(`${v}:${face}`, img);
      }
    }
    this.ready = Promise.all(loads).then(() => undefined);
  }

  get(v: number, face: Face): HTMLImageElement | undefined {
    const img = this.images.get(`${v}:${face}`);
    return img && img.complete && img.naturalWidth > 0 ? img : undefined;
  }
}

/* ---------- canvas drawing ---------- */

const HEART = new Path2D(
  'M0 3.2C-3.6 0.4 -5 -1.2 -5 -2.8C-5 -4.4 -3.8 -5.4 -2.5 -5.4C-1.4 -5.4 -0.5 -4.8 0 -4C0.5 -4.8 1.4 -5.4 2.5 -5.4C3.8 -5.4 5 -4.4 5 -2.8C5 -1.2 3.6 0.4 0 3.2Z',
);

export interface CatDrawOpts {
  /** Neighbor warmth / own hearts. 1 = exactly tucked in. */
  ratio?: number;
  /** Neighbor values, bottom-first, for the blanket stripes. */
  stripes?: number[];
  /** Override the face (otherwise derived from ratio). */
  face?: Face;
  cushion?: boolean;
  alpha?: number;
}

/** Draws one cat tile into the square at (x, y) with side `size`. */
export function drawCat(ctx: CanvasRenderingContext2D, sprites: CatSprites, x: number, y: number, size: number, v: number, o: CatDrawOpts = {}): void {
  const f = FAMILIES[v];
  if (!f) return;
  const ratio = o.ratio ?? 0;
  const face = o.face ?? faceFor(ratio);
  const full = face === 'asleep' || face === 'grumpy' ? 1 : Math.max(0, Math.min(1, ratio));
  const s = catScale(v);
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);

  if (o.cushion !== false) {
    ctx.fillStyle = f.blanket;
    roundRect(ctx, 8, 85, 84, 14, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, 8, 85, 84, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < v; i++) {
      ctx.save();
      ctx.translate(50 + (i - (v - 1) / 2) * 13, 92.5);
      ctx.scale(0.95, 0.95);
      ctx.fill(HEART);
      ctx.restore();
    }
  }

  const img = sprites.get(v, face);
  if (img) ctx.drawImage(img, 0, 0, 100, 100);

  // Blanket, in the cat's own coordinates.
  ctx.translate(47, 87 - 46 * s);
  ctx.scale(s, s);
  const topY = 34 - full * 44;
  const edge = new Path2D();
  const bw = 50;
  const scallops = 6;
  const sw = (bw * 2) / scallops;
  edge.moveTo(-bw, 46);
  edge.lineTo(-bw, topY);
  for (let i = 0; i < scallops; i++) edge.quadraticCurveTo(-bw + i * sw + sw / 2, topY - 6, -bw + (i + 1) * sw, topY);
  edge.lineTo(bw, 46);
  edge.closePath();
  ctx.fillStyle = f.blanket;
  ctx.fill(edge);
  ctx.save();
  ctx.clip(edge);
  if (o.stripes?.length) {
    let yy = 34;
    for (const nv of o.stripes) {
      const h = (44 * nv) / v;
      ctx.fillStyle = familyColor(nv);
      ctx.fillRect(-52, yy - h, 104, h);
      ctx.fillStyle = 'rgba(30,20,50,.35)';
      ctx.fillRect(-52, yy - h, 104, 2.2);
      yy -= h;
    }
  }
  ctx.globalAlpha *= 0.55;
  ctx.strokeStyle = f.knit;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    ctx.moveTo(-50, 46 - i * 7);
    ctx.lineTo(50, 46 - i * 7);
  }
  ctx.stroke();
  ctx.restore();

  if (full < 0.98) {
    ctx.fillStyle = f.belly;
    ctx.beginPath();
    ctx.ellipse(-14, topY - 1, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.ellipse(14, topY - 1, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
