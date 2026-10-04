// src/components/admin/audit/audit-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EMPTY, caracasDateTime } from '@/lib/finance/format';
import { auditActionLabel, formatAuditDetails, isAuditAction } from '@/lib/audit-labels';
import type { AuditRow } from '@/lib/audit';

function ActionLabel({ action }: { action: string }) {
  // Unknown values (older or foreign rows) are shown raw, visibly different.
  return (
    <span className={cn('font-medium', !isAuditAction(action) && 'font-mono text-muted-foreground')}>
      {auditActionLabel(action)}
    </span>
  );
}

/** Stacked cards below `md`, a table from `md` up. Rows are newest first. */
export function AuditList({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      <ul aria-label="Registro de auditoría" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="audit-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <ActionLabel action={r.action} />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{caracasDateTime(r.at)}</span>
            </div>
            <p className="mt-1 break-all text-sm">{r.actor_email}</p>
            {r.target && <p className="break-all font-mono text-xs text-muted-foreground">{r.target}</p>}
            <p className="mt-2 break-words border-t pt-2 text-xs text-muted-foreground">{formatAuditDetails(r.details)}</p>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha (Caracas)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.at)}</TableCell>
                <TableCell>{r.actor_email}</TableCell>
                <TableCell><ActionLabel action={r.action} /></TableCell>
                <TableCell className="font-mono text-xs">{r.target || EMPTY}</TableCell>
                <TableCell className="max-w-md whitespace-normal break-words text-xs text-muted-foreground">
                  {formatAuditDetails(r.details)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
