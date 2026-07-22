// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from './admin-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));

describe('AdminShell', () => {
  it('renders brand, nav, admin account and topbar context', () => {
    render(<AdminShell email="admin@club.com" topbar={<span>Reservas del día</span>}><p>contenido</p></AdminShell>);
    expect(screen.getByText(/Club La Piscina/)).toBeInTheDocument();
    expect(screen.getAllByText(/Hoy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Configuración/)).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
    expect(screen.getByText('Reservas del día')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
