'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale, type Locale } from '@/lib/i18n/types';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists the visitor's language. Setting a cookie in a server action makes
 * Next 16 re-render the current route; the caller still runs router.refresh()
 * (roadmap §3.3).
 */
export async function setLocale(locale: Locale): Promise<void> {
  // Server actions are public endpoints: never trust the argument's type.
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true, // only the server reads it
    secure: process.env.NODE_ENV === 'production',
  });
}
