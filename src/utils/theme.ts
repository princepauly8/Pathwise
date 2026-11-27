import type { ThemePreference } from '../types/study';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pathwise_theme_v1';

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value;
  }
  return 'light';
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean = getSystemPrefersDark()
): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function loadThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'light';
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePreference(preference));
  } catch {
    // Ignore storage quota or private mode errors gracefully
  }
}

export function applyThemeToDocument(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function subscribeToSystemTheme(
  callback: (prefersDark: boolean) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (event: MediaQueryListEvent) => {
    callback(event.matches);
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }
  return () => {};
}
