/**
 * A world theme: everything a world swaps out. The rules, pieces, swap, night light
 * and chains are the shared game; a theme only decides how pieces look and what
 * the game calls them. Cat Nap Alley is one theme; other worlds bring their own.
 */

/** How satisfied a piece is: needs more, nearly there, exactly full (clears), too much. */
export type Mood = 'idle' | 'close' | 'done' | 'over';

export function moodFor(ratio: number): Mood {
  if (ratio > 1) return 'over';
  if (ratio === 1) return 'done';
  return ratio >= 0.6 ? 'close' : 'idle';
}

export interface PieceDrawOpts {
  /** Received / needed, animated. 1 = exactly full. */
  ratio?: number;
  /** Exact received amount, for the need meter. Omit for a plain (unmeasured) piece. */
  received?: number;
  /** Received amount before a previewed drop; the difference is drawn as newly gained. */
  receivedBefore?: number;
  /** Values of the touching pieces, bottom first (some themes draw them). */
  neighbors?: number[];
  mood?: Mood;
  /** Draw the base the piece sits on (with its need meter). */
  base?: boolean;
  alpha?: number;
}

/** Draws a world's pieces. */
export interface PieceArt {
  readonly ready: Promise<void>;
  /** One piece into the square at (x, y) with side `size`. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, o?: PieceDrawOpts): void;
  /** The piece clearing: drawn while it fades out (k goes 0 → 1). */
  drawClearing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, v: number, k: number, reduced: boolean): void;
  /** Accent color for a size (particles, map nodes). */
  color(v: number): string;
  /** Standalone image of a piece, for HTML (intro card, map). */
  iconUrl(v: number): string;
  /** Inline SVG of one unit of need (a heart for cats), for HTML. */
  readonly unitSvg: string;
}

/** The words a world uses. */
export interface ThemeWords {
  /** Plural piece name: "cats". */
  pieces: string;
  /** Name per size, plural, index = size: "kittens". */
  sizeNames: readonly string[];
  /** Verb for clearing a piece: "Tuck in". */
  clearVerb: string;
  /** Past form for the lose card: "tucked in". */
  cleared: string;
  /** Pieces not yet cleared: "still awake". */
  notCleared: string;
  /** Name of one unit of need: "heart". */
  unit: string;
  /** Short rule for the play screen, as HTML. */
  rule: string;
  /** Hint shown with a mouse. */
  mouseHint: string;
  /** Title on a won level card. */
  winTitle: string;
  /** Name of the full-chain preview boost: "Night light". */
  boost: string;
}

export interface Theme {
  id: string;
  words: ThemeWords;
  art: PieceArt;
}
