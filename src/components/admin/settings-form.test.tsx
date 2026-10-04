// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from './settings-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpdateSettings: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminUpsertRole: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

const settings = { daily_capacity: 100, adult_price_usd: 7, child_price_usd: 1, last_bcv_rate: null, last_bcv_rate_at: null };
const roles = [{ email: 'admin@club.com', role: 'owner' as const, explicit: false }];

function renderForm(overrides: { date: string; capacity: number; reason: string | null }[] = [], initialTab: 'general' | 'excepciones' | 'accesos' = 'general') {
  return render(
    <SettingsForm settings={settings} overrides={overrides} roles={roles} currentEmail="admin@club.com"
      initialTab={initialTab} today="2030-08-01" now={Date.parse('2030-08-01T12:00:00Z')} />,
  );
}

beforeEach(() => window.history.replaceState(null, '', '/admin/settings'));

describe('SettingsForm', () => {
  it('shows a live price preview for 2 adults and 1 child', () => {
    renderForm();
    expect(screen.getByText(/\$15\.00 USD/)).toBeInTheDocument();
  });

  it('shows empty state when there are no overrides', () => {
    renderForm();
    expect(screen.getByText(/No tienes excepciones configuradas/i)).toBeInTheDocument();
  });

  it('renders a closed-day exception as "Complejo cerrado" with a "Cerrado" badge', () => {
    renderForm([{ date: '2030-08-15', capacity: 0, reason: null }]);
    expect(screen.getByText(/Complejo cerrado/i)).toBeInTheDocument();
    expect(screen.getByText('Cerrado')).toBeInTheDocument();
  });

  it('disables "Guardar configuración" until there are unsaved changes', async () => {
    renderForm();
    const save = screen.getByRole('button', { name: /Guardar configuración/i });
    expect(save).toBeDisabled();
    const cap = screen.getByRole('spinbutton', { name: 'Capacidad diaria' });
    await userEvent.clear(cap);
    await userEvent.type(cap, '120');
    expect(save).toBeEnabled();
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Descartar/i }));
    expect(save).toBeDisabled();
  });

  it('opens on the tab from the URL and offers the three tabs', () => {
    renderForm([], 'accesos');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['General', 'Excepciones', 'Accesos']);
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('admin@club.com');
  });

  it('keeps unsaved General edits when switching tabs', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Excepciones' }));
    await userEvent.click(screen.getByRole('tab', { name: 'General' }));
    expect(screen.getByRole('spinbutton', { name: 'Capacidad diaria' })).toHaveValue('101');
  });

  it('has no audit/logs tab (that lives in /admin/audit)', () => {
    renderForm();
    expect(screen.queryByRole('tab', { name: /Registro|Logs|Auditoría/i })).toBeNull();
  });
});
