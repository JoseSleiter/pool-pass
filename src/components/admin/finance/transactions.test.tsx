// src/components/admin/finance/transactions.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReceiptText } from 'lucide-react';
import type { TransactionRow } from '@/lib/finance/transactions';
import { EmptyState } from './empty-state';
import { StatusChip } from './status-chip';
import { TransactionsFilters } from './transactions-filters';
import { TransactionsTotals, paymentsLabel } from './transactions-totals';
import { TransactionsList } from './transactions-list';

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 'r1', code: 'PP-AAAAA', first_name: 'Ana', last_name: 'Pérez',
    total_usd: 35, bcv_rate: 36.5, total_ves: 1277.5, status: 'confirmed',
    payment_ref: 'C2P-123', checked_in_at: null, created_at: '2026-10-04T14:05:00Z',
    ...over,
  };
}

describe('EmptyState', () => {
  it('announces a title and an explanation', () => {
    render(<EmptyState icon={ReceiptText} title="Nada por aquí">Prueba otro rango.</EmptyState>);
    const box = screen.getByRole('status');
    expect(within(box).getByText('Nada por aquí')).toBeInTheDocument();
    expect(within(box).getByText('Prueba otro rango.')).toBeInTheDocument();
  });
});

describe('StatusChip', () => {
  it('reuses the central status label and colour', () => {
    render(<StatusChip row={{ status: 'pending_payment', checked_in_at: null }} />);
    expect(screen.getByText('Pago en verificación')).toHaveClass('bg-amber-100');
  });
});

describe('TransactionsFilters', () => {
  it('is a GET form prefilled with the current query that keeps the page size', () => {
    const { container } = render(
      <TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', status: 'failed', page: 3, pageSize: 25 }} />,
    );
    const form = screen.getByRole('form', { name: 'Filtros de transacciones' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/admin/finance/transactions');
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-05');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-10-04');
    expect(screen.getByLabelText('Estado')).toHaveValue('failed');
    expect(container.querySelector('input[type="hidden"][name="pageSize"]')).toHaveValue('25');
    // No page input: filtering always goes back to page 1.
    expect(container.querySelector('[name="page"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Restablecer' })).toHaveAttribute('href', '/admin/finance/transactions');
  });

  it('offers every transaction status plus "Todos"', () => {
    render(<TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 }} />);
    const options = within(screen.getByLabelText('Estado')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Todos', 'Confirmada', 'Ingresó', 'Pago en verificación', 'Fallida']);
    expect(screen.getByLabelText('Estado')).toHaveValue('');
  });

  it('uses 44px controls', () => {
    render(<TransactionsFilters query={{ dateFrom: '2026-09-05', dateTo: '2026-10-04', page: 1, pageSize: 10 }} />);
    expect(screen.getByLabelText('Desde')).toHaveClass('h-11');
    expect(screen.getByRole('button', { name: 'Filtrar' })).toHaveClass('h-11');
  });
});

describe('TransactionsTotals', () => {
  it('shows collected in USD and Bs., and pending in USD only', () => {
    render(<TransactionsTotals totals={{ collectedUsd: 50, collectedVes: 1825, collectedCount: 2, pendingUsd: 15, pendingCount: 1 }} />);
    const region = screen.getByRole('region', { name: 'Totales del rango' });
    const collected = within(region).getByTestId('totals-collected');
    expect(within(collected).getByText('$50.00')).toBeInTheDocument();
    expect(within(collected).getByText('Bs. 1825.00 · 2 pagos')).toBeInTheDocument();
    const pending = within(region).getByTestId('totals-pending');
    expect(within(pending).getByText('$15.00')).toBeInTheDocument();
    expect(within(pending).getByText(/1 pago · el monto en Bs\. se fija al confirmar/)).toBeInTheDocument();
  });

  it('pluralizes payments', () => {
    expect(paymentsLabel(0)).toBe('0 pagos');
    expect(paymentsLabel(1)).toBe('1 pago');
    expect(paymentsLabel(7)).toBe('7 pagos');
  });
});

describe('TransactionsList', () => {
  const rows = [
    tx(),
    tx({ id: 'r2', code: 'PP-BBBBB', status: 'pending_payment', payment_ref: null, bcv_rate: null, total_ves: null, total_usd: 5 }),
  ];

  it('renders a desktop table with every column in Caracas time', () => {
    render(<TransactionsList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha/hora de creación', 'Código', 'Cliente', 'Monto USD', 'Tasa BCV', 'Monto Bs.', 'Referencia C2P', 'Estado',
    ]);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first).getByText('04/10/2026 10:05')).toBeInTheDocument();
    expect(within(first).getByText('PP-AAAAA')).toBeInTheDocument();
    expect(within(first).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(first).getByText('$35.00')).toBeInTheDocument();
    expect(within(first).getByText('Bs. 36.5000')).toBeInTheDocument();
    expect(within(first).getByText('Bs. 1277.50')).toBeInTheDocument();
    expect(within(first).getByText('C2P-123')).toBeInTheDocument();
    expect(within(first).getByText('Confirmada')).toBeInTheDocument();
    // Pending: no rate, no Bs. amount and no C2P reference yet.
    expect(within(second).getAllByText('—')).toHaveLength(3);
    expect(within(second).getByText('Pago en verificación')).toBeInTheDocument();
  });

  it('renders one stacked card per row for mobile', () => {
    render(<TransactionsList rows={rows} />);
    const cards = screen.getAllByTestId('tx-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('PP-AAAAA')).toBeInTheDocument();
    expect(within(cards[0]).getByText('C2P-123')).toBeInTheDocument();
    expect(within(cards[1]).getAllByText('—')).toHaveLength(3);
  });
});
