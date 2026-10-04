// src/components/admin/finance/bcv-history-list.tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { caracasDateTime, formatRate } from '@/lib/finance/format';
import {
  formatVariation, sourceLabel, variationTrend, type BcvRowWithVariation, type VariationTrend,
} from '@/lib/finance/bcv';

const SOURCE_CHIP: Record<string, string> = {
  auto: 'bg-slate-100 text-slate-700',
  manual: 'bg-sky-100 text-sky-800',
};

const TREND_CLASS: Record<VariationTrend, string> = {
  up: 'text-amber-700',
  down: 'text-teal-700',
  flat: 'text-muted-foreground',
  none: 'text-muted-foreground',
};

function SourceChip({ source }: { source: string | null }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold',
        SOURCE_CHIP[source ?? ''] ?? 'bg-slate-50 text-slate-500',
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}

function Variation({ pct }: { pct: number | null }) {
  const trend = variationTrend(pct);
  return (
    <span
      className={cn('tabular-nums font-medium', TREND_CLASS[trend])}
      title={trend === 'none' ? 'Sin registro anterior' : undefined}
    >
      {formatVariation(pct)}
    </span>
  );
}

/** Stacked cards below `md`, a table from `md` up. Rows are newest first. */
export function BcvHistoryList({ rows }: { rows: BcvRowWithVariation[] }) {
  return (
    <>
      <ul aria-label="Tasas BCV" className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} data-testid="bcv-card" className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-lg font-extrabold tabular-nums">{formatRate(r.rate)}</span>
              <SourceChip source={r.source} />
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{caracasDateTime(r.fetched_at)}</span>
              <Variation pct={r.variationPct} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden rounded-2xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha (Caracas)</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Variación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{caracasDateTime(r.fetched_at)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(r.rate)}</TableCell>
                <TableCell><SourceChip source={r.source} /></TableCell>
                <TableCell className="text-right"><Variation pct={r.variationPct} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
