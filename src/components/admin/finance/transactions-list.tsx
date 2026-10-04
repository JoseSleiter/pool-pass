// src/components/admin/finance/transactions-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EMPTY, caracasDateTime, formatBs, formatRate, formatUsd } from '@/lib/finance/format';
import type { TransactionRow } from '@/lib/finance/transactions';
import { StatusChip } from './status-chip';

const NUM = 'text-right tabular-nums';

/** Stacked cards below `md`, a table from `md` up. */
export function TransactionsList({ rows }: { rows: TransactionRow[] }) {
  return (
    <>
      <ul aria-label="Transacciones" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="tx-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono font-semibold">{r.code}</span>
              <StatusChip row={r} />
            </div>
            <p className="mt-1 text-sm font-medium">{r.first_name} {r.last_name}</p>
            <p className="text-xs text-muted-foreground">{caracasDateTime(r.created_at)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-sm">
              <dt className="text-muted-foreground">Monto USD</dt>
              <dd className={NUM}>{formatUsd(r.total_usd)}</dd>
              <dt className="text-muted-foreground">Tasa BCV</dt>
              <dd className={NUM}>{formatRate(r.bcv_rate)}</dd>
              <dt className="text-muted-foreground">Monto Bs.</dt>
              <dd className={NUM}>{formatBs(r.total_ves)}</dd>
              <dt className="text-muted-foreground">Referencia C2P</dt>
              <dd className="break-all text-right font-mono">{r.payment_ref || EMPTY}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/hora de creación</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Monto USD</TableHead>
              <TableHead className="text-right">Tasa BCV</TableHead>
              <TableHead className="text-right">Monto Bs.</TableHead>
              <TableHead>Referencia C2P</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.created_at)}</TableCell>
                <TableCell className="font-mono font-semibold">{r.code}</TableCell>
                <TableCell>{r.first_name} {r.last_name}</TableCell>
                <TableCell className={NUM}>{formatUsd(r.total_usd)}</TableCell>
                <TableCell className={NUM}>{formatRate(r.bcv_rate)}</TableCell>
                <TableCell className={NUM}>{formatBs(r.total_ves)}</TableCell>
                <TableCell className="font-mono">{r.payment_ref || EMPTY}</TableCell>
                <TableCell><StatusChip row={r} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
