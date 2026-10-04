// src/app/admin/(dashboard)/finance/bcv/page.tsx
import { ChartLine } from 'lucide-react';
import { adminBcvHistoryPage } from '@/app/admin/finance-actions';
import { Pagination } from '@/components/admin/pagination';
import { EmptyState } from '@/components/admin/finance/empty-state';
import { BcvSparkline } from '@/components/admin/finance/bcv-sparkline';
import { BcvHistoryList } from '@/components/admin/finance/bcv-history-list';
import { parsePageParams, type RawSearchParams } from '@/lib/admin-page-params';

export const dynamic = 'force-dynamic';

const BCV_PATH = '/admin/finance/bcv';

export default async function BcvPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { page, pageSize } = parsePageParams(await searchParams);
  const { rows, total } = await adminBcvHistoryPage({ page, pageSize });

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      <header>
        <h1 className="text-xl font-extrabold">Tasas BCV</h1>
        <p className="text-sm text-muted-foreground">
          Historial de tasas oficiales obtenidas por la app (hora de Caracas).
        </p>
      </header>

      {total === 0 ? (
        <EmptyState icon={ChartLine} title="Aún no hay tasas registradas">
          La primera tasa se guarda cuando la app consulta al BCV.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={ChartLine} title="Esta página no tiene resultados">
          Vuelve a la primera página con la paginación de abajo.
        </EmptyState>
      ) : (
        <>
          <BcvSparkline rows={rows} />
          <BcvHistoryList rows={rows} />
        </>
      )}

      {total > 0 && (
        <Pagination pathname={BCV_PATH} params={{}} page={page} pageSize={pageSize} total={total} noun="registros" />
      )}
    </div>
  );
}
