import 'server-only';
import { cookies } from 'next/headers';
import { es } from './es';
import { en } from './en';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Dictionary, type Locale } from './types';

const dictionaries: Record<Locale, Dictionary> = { es, en };

/**
 * Visitor's language from the `pp_lang` cookie; anything missing or unknown
 * falls back to Spanish. `cookies()` is async in Next 16 and makes the
 * calling route dynamic.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
