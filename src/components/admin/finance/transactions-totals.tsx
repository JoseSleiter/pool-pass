// src/components/admin/finance/transactions-totals.tsx
import { formatBs, formatUsd } from '@/lib/finance/format';
import type { TransactionTotals } from '@/lib/finance/transactions';

export function paymentsLabel(n: number): string {
  return n === 1 ? '1 pago' : `${n} pagos`;
}

/** Totals for the whole date range (status filter not applied). */
export function TransactionsTotals({ totals }: { totals: TransactionTotals }) {
  return (
    <section aria-label="Totales del rango" className="grid gap-3 sm:grid-cols-2">
      <div data-testid="totals-collected" className="rounded-2xl border bg-white p-4">
        <p className="text-sm text-muted-foreground">Cobrado (confirmadas + ingresaron)</p>
        <p className="text-2xl font-extrabold tabular-nums">{formatUsd(totals.collectedUsd)}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {`${formatBs(totals.collectedVes)} · ${paymentsLabel(totals.collectedCount)}`}
        </p>
      </div>
      <div data-testid="totals-pending" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900">Por verificar</p>
        <p className="text-2xl font-extrabold tabular-nums text-amber-900">{formatUsd(totals.pendingUsd)}</p>
        <p className="text-sm text-amber-900/80">
          {`${paymentsLabel(totals.pendingCount)} · el monto en Bs. se fija al confirmar`}
        </p>
      </div>
    </section>
  );
}
