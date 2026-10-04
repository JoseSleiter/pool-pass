// src/components/admin/admin-shell.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));

import { AdminShell } from './admin-shell';
import { SIDEBAR_COLLAPSED_KEY, resetSidebarCollapsedMemory } from './use-sidebar-collapsed';
import type { ShellStatus } from './topbar-data';

const status: ShellStatus = { bcv: { rate: 36.45, at: '2026-10-04T13:00:00Z' }, pendingCount: 2, today: '2026-10-04' };

function renderShell(role: 'owner' | 'operator' = 'owner') {
  return render(
    <AdminShell user={{ email: `${role}@club.com`, role }} status={status}>
      <p>contenido</p>
    </AdminShell>,
  );
}

describe('AdminShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSidebarCollapsedMemory();
  });

  it('renders brand, owner nav, profile, topbar and content', () => {
    renderShell('owner');
    expect(screen.getAllByAltText('Complejo Turístico Villa Victoria').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByText('owner@club.com')).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
    expect(screen.getByText('BCV · Bs. 36.45')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 pagos pendientes por verificar' })).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('hides owner-only items from operators', () => {
    renderShell('operator');
    expect(screen.queryByRole('link', { name: 'Configuración' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Auditoría' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Transacciones C2P' })).toHaveAttribute('href', '/admin/finance/transactions');
    expect(screen.getByRole('link', { name: 'Tasas BCV' })).toHaveAttribute('href', '/admin/finance/bcv');
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('shows owners the finance and audit pages', () => {
    renderShell('owner');
    expect(screen.getByRole('link', { name: 'Transacciones C2P' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasas BCV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Auditoría' })).toHaveAttribute('href', '/admin/audit');
  });

  it('renders the reservations route once it is ready', () => {
    renderShell('owner');
    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('href', '/admin/reservations');
  });

  it('has a 44px mobile menu button', () => {
    renderShell('owner');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveClass('size-11');
  });

  it('collapses the sidebar and remembers it', async () => {
    renderShell('owner');
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveAttribute('title', 'Hoy');
  });

  it('starts collapsed when that was the stored choice', () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    renderShell('owner');
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toBeInTheDocument();
  });
});
