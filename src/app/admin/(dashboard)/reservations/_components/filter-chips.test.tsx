// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActiveFilters, StatusChips } from './filter-chips';
import type { StatusCounts } from '@/lib/db/reservation-counts';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';

const COUNTS: StatusCounts = { all: 12, confirmed: 5, checked_in: 3, pending: 2, canceled: 2 };
const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });

describe('StatusChips', () => {
  it('renders the five chips as 44px links with their counts, "Todas" active by default', () => {
    render(<StatusChips state={DEFAULT_STATE} counts={COUNTS} />);
    const nav = screen.getByRole('navigation', { name: 'Filtrar por estado' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual([
      'Todas 12', 'Confirmadas 5', 'Ingresaron 3', 'Pendientes 2', 'Canceladas 2',
    ]);
    expect(screen.getByRole('link', { name: 'Todas 12' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Canceladas 2' })).toHaveAttribute('href', '/admin/reservations?status=failed%2Cexpired');
    for (const a of links) expect(a).toHaveClass('min-h-11');
  });

  it('keeps the search, resets the page and marks the active chip', () => {
    render(<StatusChips state={S({ q: 'ana', page: 4, statuses: ['pending_payment'] })} counts={COUNTS} />);
    expect(screen.getByRole('link', { name: 'Pendientes 2' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Todas 12' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Confirmadas 5' })).toHaveAttribute('href', '/admin/reservations?q=ana&status=confirmed');
    expect(screen.getByRole('link', { name: 'Todas 12' })).toHaveAttribute('href', '/admin/reservations?q=ana');
  });

  it('shows zero counts and formats thousands', () => {
    render(<StatusChips state={DEFAULT_STATE} counts={{ ...COUNTS, all: 1234, pending: 0 }} />);
    expect(screen.getByRole('link', { name: 'Pendientes 0' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Todas 1[.,\u00a0\s]?234$/ })).toBeInTheDocument();
  });
});

describe('ActiveFilters', () => {
  it('renders nothing without filters', () => {
    const { container } = render(<ActiveFilters state={DEFAULT_STATE} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('each chip removes its own filter; "Limpiar todo" removes all', () => {
    render(<ActiveFilters state={S({ statuses: ['confirmed'], guest: 'family' })} />);
    expect(screen.getByRole('link', { name: 'Quitar filtro Estado: Confirmada' })).toHaveAttribute('href', '/admin/reservations?guest=family');
    expect(screen.getByRole('link', { name: 'Quitar filtro Grupo: Familia' })).toHaveAttribute('href', '/admin/reservations?status=confirmed');
    expect(screen.getByRole('link', { name: 'Limpiar todo' })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByText('Estado: Confirmada')).toBeInTheDocument();
  });
});
