// src/components/admin/topbar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let pathname = '/admin/settings';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { BcvBadge, Breadcrumb, PendingBell, Topbar } from './topbar';

describe('Breadcrumb', () => {
  it('shows group and current page from the nav config', () => {
    render(<Breadcrumb pathname="/admin/settings" />);
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeInTheDocument();
    expect(screen.getByText('Gestión')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to "Panel" outside the nav', () => {
    render(<Breadcrumb pathname="/admin/unknown" />);
    expect(screen.getByText('Panel')).toHaveAttribute('aria-current', 'page');
  });
});

describe('BcvBadge', () => {
  it('shows the cached rate with two decimals', () => {
    render(<BcvBadge bcv={{ rate: 36.4512, at: '2026-10-04T13:00:00Z' }} />);
    expect(screen.getByText('BCV · Bs. 36.45')).toBeInTheDocument();
  });

  it('says "sin tasa" when there is no cached rate', () => {
    render(<BcvBadge bcv={null} />);
    expect(screen.getByText('BCV · sin tasa')).toBeInTheDocument();
  });
});

describe('PendingBell', () => {
  it('links to the admin home with the pending count', () => {
    render(<PendingBell count={3} />);
    const bell = screen.getByRole('link', { name: '3 pagos pendientes por verificar' });
    expect(bell).toHaveAttribute('href', '/admin');
    expect(bell).toHaveClass('size-11');
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses the singular for one payment', () => {
    render(<PendingBell count={1} />);
    expect(screen.getByRole('link', { name: '1 pago pendiente por verificar' })).toBeInTheDocument();
  });

  it('shows no counter at zero and caps it at 99+', () => {
    const { rerender } = render(<PendingBell count={0} />);
    expect(screen.getByRole('link', { name: '0 pagos pendientes por verificar' })).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
    rerender(<PendingBell count={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not invent a number when the count failed to load', () => {
    render(<PendingBell count={null} />);
    expect(screen.getByRole('link', { name: 'Pagos pendientes' })).toBeInTheDocument();
  });
});

describe('Topbar', () => {
  it('combines breadcrumb, Caracas date, BCV badge and bell for the current path', () => {
    pathname = '/admin';
    render(<Topbar status={{ bcv: null, pendingCount: 2, today: '2026-10-04' }} />);
    expect(screen.getByText('Hoy')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(/4 de octubre/)).toHaveAttribute('dateTime', '2026-10-04');
    expect(screen.getByText('BCV · sin tasa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 pagos pendientes por verificar' })).toBeInTheDocument();
  });
});
