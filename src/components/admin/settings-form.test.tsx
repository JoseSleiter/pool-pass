// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './settings-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
}));

const settings = { daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1, last_bcv_rate: null, last_bcv_rate_at: null };

describe('SettingsForm', () => {
  it('shows a live price preview for 2 adults and 1 child', () => {
    render(<SettingsForm settings={settings} overrides={[]} />);
    expect(screen.getByText(/\$15\.00 USD/)).toBeInTheDocument();
  });

  it('shows empty state when there are no overrides', () => {
    render(<SettingsForm settings={settings} overrides={[]} />);
    expect(screen.getByText(/No tienes excepciones configuradas/i)).toBeInTheDocument();
  });

  it('renders a closed-day exception as "Complejo cerrado" with a "Cerrado" badge', () => {
    render(<SettingsForm settings={settings} overrides={[{ date: '2030-08-15', capacity: 0, reason: null }]} />);
    expect(screen.getByText(/Complejo cerrado/i)).toBeInTheDocument();
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
  });

  it('disables "Guardar configuración" until there are unsaved changes', async () => {
    render(<SettingsForm settings={settings} overrides={[]} />);
    const save = screen.getByRole('button', { name: /Guardar configuración/i });
    expect(save).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/Capacidad diaria/i));
    await userEvent.type(screen.getByLabelText(/Capacidad diaria/i), '120');
    expect(save).toBeEnabled();
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    // Descartar reverts to the persisted value and disables save again
    await userEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(save).toBeDisabled();
  });
});
