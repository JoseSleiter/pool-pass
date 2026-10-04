// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

import { GeneralPanel } from './general-panel';
import { adminUpdateSettings } from '@/app/admin/actions';

const NOW = Date.parse('2030-01-15T16:00:00Z');
const settings = {
  daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1,
  last_bcv_rate: 36.5, last_bcv_rate_at: '2030-01-15T15:30:00Z',
};

const adultsLine = () => screen.getByText(/Si todos son adultos/).closest('li')!;
const childrenLine = () => screen.getByText(/Si todos son niños/).closest('li')!;

beforeEach(() => vi.clearAllMocks());

describe('GeneralPanel', () => {
  it('projects full-capacity revenue as an honest range', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByText(/Con 100 personas \(100 % de la capacidad\)/)).toBeInTheDocument();
    expect(adultsLine()).toHaveTextContent('$700.00');
    expect(childrenLine()).toHaveTextContent('$100.00');
    expect(screen.getByText(/depende de cuántos adultos y niños/)).toBeInTheDocument();
  });

  it('shows the VES equivalent at the cached BCV rate', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByText(/Bs\. 3650\.00 – Bs\. 25550\.00/)).toBeInTheDocument();
  });

  it('updates the projection live when a stepper changes', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    expect(adultsLine()).toHaveTextContent('$707.00');

    const adult = screen.getByRole('spinbutton', { name: 'Precio adulto (USD)' });
    adult.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(adult).toHaveValue('7.5');
    expect(adultsLine()).toHaveTextContent('$757.50');
  });

  it('asks to complete the fields when one is empty', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Capacidad diaria' }));
    expect(screen.getByText('Completa capacidad y precios para ver la proyección.')).toBeInTheDocument();
  });

  it('tracks dirty state, saves parsed numbers and can discard', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    const save = screen.getByRole('button', { name: 'Guardar configuración' });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    expect(screen.getByText('Tienes cambios sin guardar.')).toBeInTheDocument();
    expect(save).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.getByRole('spinbutton', { name: 'Capacidad diaria' })).toHaveValue('100');
    expect(save).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    await userEvent.click(save);
    expect(adminUpdateSettings).toHaveBeenCalledWith({ daily_capacity: 101, adult_price_usd: 7, child_price_usd: 1 });
    expect(await screen.findByText('✓ Todos los cambios están guardados.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('does not save when a field is empty', async () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Precio niño (USD)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(screen.getByText('Todos los campos son requeridos.')).toBeInTheDocument();
    expect(adminUpdateSettings).not.toHaveBeenCalled();
  });

  it('includes the BCV card', () => {
    render(<GeneralPanel settings={settings} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Tasa BCV' })).toBeInTheDocument();
  });
});
