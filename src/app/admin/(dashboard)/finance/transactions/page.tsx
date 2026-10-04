// src/app/admin/(dashboard)/finance/transactions/page.tsx
import { ReceiptText } from 'lucide-react';
import { adminListTransactions } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { TRANSACTIONS_PATH, TransactionsFilters } from '@/components/admin/finance/transactions-filters';
import { TransactionsTotals } from '@/components/admin/finance/transactions-totals';
import { TransactionsList } from '@/components/admin/finance/transactions-list';
import { todayCaracas } from '@/lib/dates';
import { parseTransactionParams, transactionLinkParams } from '@/lib/finance/transactions';
import type { RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const query = parseTransactionParams(await searchParams, todayCaracas());
  const { rows, total, totals } = await adminListTransactions(query);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header>
        <h1 className="text-xl font-extrabold">Transacciones C2P</h1>
        <p className="text-sm text-muted-foreground">
          Reservas que llegaron al pago, por fecha de creación (hora de Caracas).
        </p>
      </header>

      <TransactionsFilters query={query} />
      <TransactionsTotals totals={totals} />

      {total === 0 ? (
        <EmptyState icon={ReceiptText} title="No hay transacciones en este rango">
          Prueba con otras fechas o con otro estado.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <TransactionsList rows={rows} />
      )}

      {total > 0 && (
        <Pagination
          pathname={TRANSACTIONS_PATH}
          params={transactionLinkParams(query)}
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          noun="transacciones"
        />
      )}
    </div>
  );
}
