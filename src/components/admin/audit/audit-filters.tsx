// src/components/admin/audit/audit-filters.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { AUDIT_ACTIONS, AUDIT_ACTION_LABELS, type AuditQuery } from '@/lib/audit-labels';

export const AUDIT_PATH = '/admin/audit';

/** Plain GET form: filtering goes back to page 1, page size is kept. */
export function AuditFilters({ query }: { query: AuditQuery }) {
  return (
    <form
      method="get"
      action={AUDIT_PATH}
      aria-label="Filtro de auditoría"
      className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
    >
      <div className="grid gap-1">
        {/* htmlFor, not wrapping: option text must not leak into the label. */}
        <label htmlFor="audit-action" className="text-sm font-medium">Acción</label>
        <select
          id="audit-action"
          name="action"
          defaultValue={query.action ?? ''}
          className={cn(ADMIN_INPUT, 'w-full rounded-lg border border-border bg-background px-3')}
        >
          <option value="">Todas las acciones</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{AUDIT_ACTION_LABELS[a]}</option>
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
        href={AUDIT_PATH}
        className={cn(ADMIN_ACTION, 'inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted')}
      >
        Restablecer
      </Link>
    </form>
  );
}
