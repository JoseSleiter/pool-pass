// src/components/admin/finance/transactions-filters.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { statusLabelEs } from '@/lib/reservation-status';
import { TRANSACTION_STATUSES, type TransactionQuery } from '@/lib/finance/transactions';

export const TRANSACTIONS_PATH = '/admin/finance/transactions';

const FIELD = cn(ADMIN_INPUT, 'w-full rounded-lg border border-border bg-background px-3');
const GROUP = 'grid gap-1';
const LABEL = 'text-sm font-medium';

/**
 * Plain GET form (no client JS). It has no `page` field, so applying filters
 * always lands on page 1; the page size is kept in a hidden field.
 * Labels use htmlFor (not wrapping) so a select's option text never leaks
 * into its accessible name.
 */
export function TransactionsFilters({ query }: { query: TransactionQuery }) {
  return (
    <form
      method="get"
      action={TRANSACTIONS_PATH}
      aria-label="Filtros de transacciones"
      className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end"
    >
      <div className={GROUP}>
        <label htmlFor="tx-from" className={LABEL}>Desde</label>
        <input id="tx-from" type="date" name="from" defaultValue={query.dateFrom} className={FIELD} />
      </div>
      <div className={GROUP}>
        <label htmlFor="tx-to" className={LABEL}>Hasta</label>
        <input id="tx-to" type="date" name="to" defaultValue={query.dateTo} className={FIELD} />
      </div>
      <div className={GROUP}>
        <label htmlFor="tx-status" className={LABEL}>Estado</label>
        <select id="tx-status" name="status" defaultValue={query.status ?? ''} className={FIELD}>
          <option value="">Todos</option>
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabelEs({ status: s, checked_in_at: null })}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="pageSize" defaultValue={query.pageSize} />
      <button
        type="submit"
        className={cn(ADMIN_ACTION, 'cursor-pointer rounded-lg bg-navy-deep font-semibold text-white')}
      >
        Filtrar
      </button>
      <Link
        href={TRANSACTIONS_PATH}
        className={cn(ADMIN_ACTION, 'inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted')}
      >
        Restablecer
      </Link>
    </form>
  );
}
