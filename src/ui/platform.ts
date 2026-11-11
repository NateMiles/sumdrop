/**
 * Thin wrappers over Capacitor plugins. On the web, Capacitor's plugins fall
 * back to navigator.vibrate and localStorage, so this works in a browser too.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export const haptics = {
  tap(): void {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  thud(): void {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  pop(chain: number): void {
    Haptics.impact({ style: chain > 1 ? ImpactStyle.Heavy : ImpactStyle.Medium }).catch(() => {});
  },
  error(): void {
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
};

export const storage = {
  async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const { value } = await Preferences.get({ key });
      return value == null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  },
};
