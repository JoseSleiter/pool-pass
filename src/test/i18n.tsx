import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/provider';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
import type { Locale } from '@/lib/i18n/types';

/** render() wrapped in the same provider the root layout mounts. Spanish by default. */
export function renderWithI18n(
  ui: ReactElement,
  { locale = 'es', ...options }: { locale?: Locale } & Omit<RenderOptions, 'wrapper'> = {}
) {
  const dict = locale === 'en' ? en : es;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        {children}
      </I18nProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
