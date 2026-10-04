// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleToggle } from './locale-toggle';
import { I18nProvider, useT } from '@/lib/i18n/provider';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';
import type { Locale } from '@/lib/i18n/types';

const h = vi.hoisted(() => ({
  cookie: 'es' as string,
  listener: null as null | ((locale: string) => void),
  refresh: vi.fn(),
}));

vi.mock('@/app/actions/locale', () => ({
  setLocale: vi.fn(async (locale: string) => {
    h.cookie = locale;
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: h.refresh }) }));

import { setLocale } from '@/app/actions/locale';

function Probe() {
  return <p data-testid="probe">{useT().booking.continue}</p>;
}

/** Mimics the root layout: re-renders the provider with the cookie's locale on refresh. */
function Harness() {
  const [locale, setLocaleState] = useState<Locale>('es');
  useEffect(() => {
    h.listener = (l) => setLocaleState(l as Locale);
    return () => {
      h.listener = null;
    };
  }, []);
  return (
    <I18nProvider locale={locale} dict={locale === 'en' ? en : es}>
      <LocaleToggle />
      <Probe />
    </I18nProvider>
  );
}

describe('LocaleToggle', () => {
  beforeEach(() => {
    h.cookie = 'es';
    vi.mocked(setLocale).mockClear();
    h.refresh.mockReset();
    h.refresh.mockImplementation(() => h.listener?.(h.cookie));
  });

  it('marks the active language', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ES' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to English: saves the cookie, refreshes and re-renders translated', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId('probe')).toHaveTextContent('Continuar');

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(setLocale).toHaveBeenCalledWith('en');
    await waitFor(() => expect(h.refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('Continue'));
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does nothing when the active language is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'ES' }));
    expect(setLocale).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });
});
