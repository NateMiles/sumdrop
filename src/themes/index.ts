import { catTheme } from './cats';
import { gemTheme } from './gems';
import type { Theme } from './types';

export * from './types';

const THEMES: Record<string, Theme> = { gems: gemTheme, cats: catTheme };

/** Endless mode uses this until it gets a theme picker. */
export const DEFAULT_THEME = gemTheme;

export const themeById = (id: string): Theme => THEMES[id] ?? DEFAULT_THEME;
