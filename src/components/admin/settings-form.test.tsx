// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders a closed-day exception as "Club cerrado"', () => {
    render(<SettingsForm settings={settings} overrides={[{ date: '2030-08-15', capacity: 0, reason: null }]} />);
    expect(screen.getByText(/Club cerrado/i)).toBeInTheDocument();
  });
});
