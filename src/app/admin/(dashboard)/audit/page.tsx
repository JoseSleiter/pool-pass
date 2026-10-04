// src/app/admin/(dashboard)/audit/page.tsx
import { ScrollText } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { adminSearchAudit } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { AUDIT_PATH, AuditFilters } from '@/components/admin/audit/audit-filters';
import { AuditList } from '@/components/admin/audit/audit-list';
import { auditLinkParams, parseAuditParams } from '@/lib/audit-labels';
import type { RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  // Owner-only (roadmap §3.2). Operators get a notice instead of an error page,
  // like settings; adminSearchAudit re-checks the owner role on its own.
  const me = await requireAdmin();
  const heading = <h1 className="text-xl font-extrabold">Auditoría</h1>;
  if (me.role !== 'owner') {
    return (
      <div className="space-y-5">
        <header>{heading}</header>
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Solo el dueño puede ver la auditoría.
        </p>
      </div>
    );
  }

  const query = parseAuditParams(await searchParams);
  const { rows, total } = await adminSearchAudit(query);

  return (
    <div className="space-y-5">
      <header>
        {heading}
        <p className="text-sm text-muted-foreground">
          Acciones de los administradores, de la más reciente a la más antigua (hora de Caracas).
        </p>
      </header>

      <AuditFilters query={query} />

      {total === 0 ? (
        <EmptyState icon={ScrollText} title="No hay acciones registradas">
          {query.action ? 'Prueba con otra acción o quita el filtro.' : 'Aquí aparecerán los cambios hechos desde el panel.'}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <AuditList rows={rows} />
      )}

      {total > 0 && (
        <Pagination
          pathname={AUDIT_PATH}
          params={auditLinkParams(query)}
          page={query.page}
          pageSize={query.pageSize}
          total={total}
          noun="registros"
        />
      )}
    </div>
  );
}
