/** Canvas colors. Keep in sync with the CSS tokens in style.css. */
export const palette = {
  bg: '#101c26',
  board: '#122230',
  column: 'rgba(255,255,255,.025)',
  columnHot: 'rgba(255,138,107,.12)',
  dangerLine: 'rgba(255,138,107,.35)',
  ink: '#e8f1f2',
  muted: '#8aa3b0',
  coral: '#ff8a6b',
  onCoral: '#2a0f08',
  gold: '#ffd95e',
  outline: '#0d1820',
  hintBg: 'rgba(16,28,38,.92)',
  tileShell: '#22333f',
  tileShadow: 'rgba(0,0,0,.3)',
  pip: '#122029',
  pipDim: 'rgba(18,32,41,.55)',
};

const TILE_COLORS: Record<number, string> = {
  1: '#7dd3c0',
  2: '#8ec5ff',
  3: '#b49cff',
  4: '#ff9ec7',
  5: '#ffb36b',
  6: '#ffd95e',
};

export const tileColor = (v: number): string => TILE_COLORS[v] ?? '#d6d6e6';
