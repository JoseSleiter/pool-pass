// src/components/admin/audit/audit.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AuditAction, AuditRow } from '@/lib/audit';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS } from '@/lib/audit-labels';
import { AuditFilters } from './audit-filters';
import { AuditList } from './audit-list';

const rows: AuditRow[] = [
  {
    id: 2, at: '2026-10-04T14:05:00Z', actor_email: 'dueno@club.com', action: 'settings.update',
    target: null, details: { daily_capacity: 80, adult_price_usd: 15 },
  },
  {
    id: 1, at: '2026-10-03T20:00:00Z', actor_email: 'ops@club.com', action: 'legacy.thing' as AuditAction,
    target: 'PP-AAAAA', details: {},
  },
];

describe('AuditFilters', () => {
  it('is a GET form with every labelled action and keeps the page size', () => {
    const { container } = render(<AuditFilters query={{ action: 'role.upsert', page: 2, pageSize: 25 }} />);
    const form = screen.getByRole('form', { name: 'Filtro de auditoría' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/admin/audit');
    const select = screen.getByLabelText('Acción');
    expect(select).toHaveValue('role.upsert');
    expect(select).toHaveClass('h-11');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas las acciones', ...AUDIT_ACTIONS.map((a) => AUDIT_ACTION_LABELS[a]),
    ]);
    expect(container.querySelector('input[type="hidden"][name="pageSize"]')).toHaveValue('25');
    expect(screen.getByRole('link', { name: 'Restablecer' })).toHaveAttribute('href', '/admin/audit');
  });
});

describe('AuditList', () => {
  it('renders a table with Caracas time, actor, Spanish action, target and compact details', () => {
    render(<AuditList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha (Caracas)', 'Actor', 'Acción', 'Objetivo', 'Detalles',
    ]);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first).getByText('04/10/2026 10:05')).toBeInTheDocument();
    expect(within(first).getByText('dueno@club.com')).toBeInTheDocument();
    expect(within(first).getByText('Configuración actualizada')).toBeInTheDocument();
    expect(within(first).getByText('daily_capacity: 80 · adult_price_usd: 15')).toBeInTheDocument();
    // No target and no details: dashes.
    expect(within(first).getAllByText('—')).toHaveLength(1);
    // Unknown action is shown raw, in monospace.
    expect(within(second).getByText('legacy.thing')).toHaveClass('font-mono');
    expect(within(second).getByText('PP-AAAAA')).toBeInTheDocument();
  });

  it('renders one card per entry for mobile', () => {
    render(<AuditList rows={rows} />);
    const cards = screen.getAllByTestId('audit-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Configuración actualizada')).toBeInTheDocument();
  });
});
