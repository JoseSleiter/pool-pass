// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DatePickerPanel } from './date-picker-panel';
import { renderWithI18n } from '@/test/i18n';

// A month far in the future: no day is disabled for being in the past.
const base = {
  date: '2099-03-10',
  availability: { '2099-03-12': 7, '2099-03-13': 0 },
  onSelect: vi.fn(),
  onMonthChange: vi.fn(),
};

function cell(container: HTMLElement, day: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`td[data-day="${day}"]:not([data-outside])`);
  if (!el) throw new Error(`no cell for ${day}`);
  return el;
}

describe('DatePickerPanel "Quedan N"', () => {
  it('labels every available day, using the default capacity for untouched days', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(cell(container, '2099-03-12')).toHaveTextContent('Quedan 7');
    expect(cell(container, '2099-03-14')).toHaveTextContent('Quedan 100');
  });

  it('does not label sold-out (disabled) days', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(cell(container, '2099-03-13')).not.toHaveTextContent(/Quedan/);
  });

  it('without a default capacity only labels days it has numbers for (/reservar today)', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} />);
    expect(cell(container, '2099-03-12')).toHaveTextContent('Quedan 7');
    expect(cell(container, '2099-03-14')).not.toHaveTextContent(/Quedan/);
  });

  it('adds the remaining slots to the day button accessible name', () => {
    renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />);
    expect(screen.getByRole('button', { name: /Quedan 7$/ })).toBeInTheDocument();
  });

  it('speaks English', () => {
    const { container } = renderWithI18n(<DatePickerPanel {...base} defaultCapacity={100} />, { locale: 'en' });
    expect(cell(container, '2099-03-12')).toHaveTextContent('7 left');
  });
});
