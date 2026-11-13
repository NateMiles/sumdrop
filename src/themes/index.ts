import { catTheme } from './cats';
import type { Theme } from './types';

export * from './types';

const THEMES: Record<string, Theme> = { cats: catTheme };

/** Endless mode uses this until it gets a theme picker. */
export const DEFAULT_THEME = catTheme;

export const themeById = (id: string): Theme => THEMES[id] ?? DEFAULT_THEME;
