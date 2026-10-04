// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { FiltersDrawer } from './filters-drawer';
import { DEFAULT_STATE, type ReservationsState } from '../_lib/search-params';

const S = (over: Partial<ReservationsState> = {}): ReservationsState => ({ ...DEFAULT_STATE, ...over });
const trigger = () => screen.getByRole('button', { name: /^Filtros/ });

beforeEach(() => router.push.mockReset());

describe('FiltersDrawer', () => {
  it('shows how many advanced filters are active on a 44px trigger', () => {
    render(<FiltersDrawer state={S({ from: '2030-01-01', guest: 'family' })} />);
    expect(trigger()).toHaveClass('h-11');
    expect(within(trigger()).getByText('2')).toBeInTheDocument();
  });

  it('applies the date range and guest type, keeping the search and resetting the page', async () => {
    render(<FiltersDrawer state={S({ q: 'ana', page: 3 })} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    fireEvent.change(within(drawer).getByLabelText('Desde'), { target: { value: '2030-01-01' } });
    fireEvent.change(within(drawer).getByLabelText('Hasta'), { target: { value: '2030-01-31' } });
    await userEvent.click(within(drawer).getByRole('radio', { name: /Familia/ }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(router.push).toHaveBeenCalledWith(
      '/admin/reservations?q=ana&from=2030-01-01&to=2030-01-31&guest=family',
      { scroll: false },
    );
  });

  it('rejects a reversed range', async () => {
    render(<FiltersDrawer state={DEFAULT_STATE} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    fireEvent.change(within(drawer).getByLabelText('Desde'), { target: { value: '2030-02-01' } });
    fireEvent.change(within(drawer).getByLabelText('Hasta'), { target: { value: '2030-01-01' } });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(within(drawer).getByRole('alert')).toHaveTextContent('La fecha final debe ser igual o posterior a la inicial.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('"Restablecer" clears the advanced filters', async () => {
    render(<FiltersDrawer state={S({ from: '2030-01-01', guest: 'family' })} />);
    await userEvent.click(trigger());
    const drawer = await screen.findByRole('dialog', { name: 'Filtros avanzados' });
    expect(within(drawer).getByLabelText('Desde')).toHaveValue('2030-01-01');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Restablecer' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Aplicar filtros' }));
    expect(router.push).toHaveBeenCalledWith('/admin/reservations', { scroll: false });
  });
});
