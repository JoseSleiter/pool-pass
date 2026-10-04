// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { Pagination, pageHref, pageWindow, rangeLabel, totalPages } from './pagination';

describe('pagination helpers', () => {
  it('totalPages is at least 1', () => {
    expect(totalPages(0, 10)).toBe(1);
    expect(totalPages(10, 10)).toBe(1);
    expect(totalPages(11, 10)).toBe(2);
    expect(totalPages(142, 25)).toBe(6);
  });

  it('rangeLabel shows the visible slice, in Spanish', () => {
    expect(rangeLabel(1, 10, 142, 'reservas')).toBe('Mostrando 1–10 de 142 reservas');
    expect(rangeLabel(15, 10, 142, 'reservas')).toBe('Mostrando 141–142 de 142 reservas');
    expect(rangeLabel(1, 25, 0, 'registros')).toBe('Sin registros');
  });

  it('pageWindow keeps first/last and neighbours, with gaps', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(pageWindow(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageWindow(10, 10)).toEqual([1, 'gap', 9, 10]);
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, 'gap', 10]);
  });

  it('pageHref keeps other params and overrides page/pageSize', () => {
    expect(pageHref('/admin/reservations', { q: 'ana', status: 'confirmed', page: '9' }, 2, 25)).toBe(
      '/admin/reservations?q=ana&status=confirmed&page=2&pageSize=25',
    );
    expect(pageHref('/admin/audit', {}, 1, 10)).toBe('/admin/audit?page=1&pageSize=10');
  });
});

describe('Pagination', () => {
  beforeEach(() => push.mockReset());

  const base = { pathname: '/admin/reservations', params: { q: 'ana' }, total: 142, noun: 'reservas' };

  it('renders the range, page links and disables boundaries on the first page', () => {
    render(<Pagination {...base} page={1} pageSize={10} />);
    expect(screen.getByText('Mostrando 1–10 de 142 reservas')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(within(nav).getByRole('link', { name: 'Página 2' })).toHaveAttribute(
      'href', '/admin/reservations?q=ana&page=2&pageSize=10',
    );
    expect(within(nav).getByText('1')).toHaveAttribute('aria-current', 'page');
    // First / previous are inert on page 1; next / last link forward.
    expect(within(nav).queryByRole('link', { name: 'Primera página' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Página anterior' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Página siguiente' })).toHaveAttribute(
      'href', '/admin/reservations?q=ana&page=2&pageSize=10',
    );
    expect(within(nav).getByRole('link', { name: 'Última página' })).toHaveAttribute(
      'href', '/admin/reservations?q=ana&page=15&pageSize=10',
    );
  });

  it('disables next/last on the last page', () => {
    render(<Pagination {...base} page={15} pageSize={10} />);
    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(within(nav).queryByRole('link', { name: 'Página siguiente' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Última página' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Página anterior' })).toHaveAttribute(
      'href', '/admin/reservations?q=ana&page=14&pageSize=10',
    );
  });

  it('changing the page size navigates back to page 1', async () => {
    render(<Pagination {...base} page={4} pageSize={10} />);
    await userEvent.selectOptions(screen.getByLabelText(/filas por página/i), '50');
    expect(push).toHaveBeenCalledWith('/admin/reservations?q=ana&page=1&pageSize=50');
  });
});
