'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Dictionary, Locale } from './types';

type I18nValue = { locale: Locale; t: Dictionary };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Mounted once in the root layout with the dictionary picked on the server.
 * After setLocale() + router.refresh() the layout re-renders with new props,
 * so every client component below re-renders in the new language without
 * losing its state.
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: dict }), [locale, dict]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT()/useLocale() must be used inside <I18nProvider>');
  return ctx;
}

export function useT(): Dictionary {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
