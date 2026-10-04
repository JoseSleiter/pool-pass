import type { es } from './es';

/** Supported UI languages. Spanish is the default and the source dictionary. */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Cookie that stores the visitor's language choice. Routes carry no locale prefix. */
export const LOCALE_COOKIE = 'pp_lang';

/** Shape of every dictionary: es.ts is the source; en.ts must match it exactly. */
export type Dictionary = typeof es;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
