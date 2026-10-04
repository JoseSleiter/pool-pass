// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLocale, useT } from './provider';
import { renderWithI18n } from '@/test/i18n';

function Probe() {
  const t = useT();
  const locale = useLocale();
  return <p>{`${locale}:${t.booking.continue}`}</p>;
}

describe('I18nProvider', () => {
  it('provides the Spanish dictionary by default in tests', () => {
    renderWithI18n(<Probe />);
    expect(screen.getByText('es:Continuar')).toBeInTheDocument();
  });

  it('provides the English dictionary', () => {
    renderWithI18n(<Probe />, { locale: 'en' });
    expect(screen.getByText('en:Continue')).toBeInTheDocument();
  });

  it('throws a clear error when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/I18nProvider/);
    spy.mockRestore();
  });
});
