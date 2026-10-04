// src/components/admin/finance/bcv-sparkline.tsx
import type { BcvHistoryRow } from '@/lib/bcv-history';
import { rateSummary, sparklinePoints } from '@/lib/finance/bcv';
import { formatRate } from '@/lib/finance/format';

const W = 240;
const H = 48;

/**
 * Minimal inline SVG trend of the visible page (no chart library, no motion).
 * The SVG is decorative (aria-hidden); the figcaption carries the same
 * information as text for screen readers and for everyone else.
 */
export function BcvSparkline({ rows }: { rows: Pick<BcvHistoryRow, 'rate'>[] }) {
  const summary = rateSummary(rows);
  if (!summary) return null;
  const points = sparklinePoints([...rows].reverse().map((r) => r.rate), W, H);
  const last = points[points.length - 1];

  return (
    <figure className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      {points.length >= 2 && (
        <svg
          data-testid="bcv-sparkline"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          aria-hidden="true"
          className="h-12 w-60 shrink-0 text-teal-600"
        >
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx={last.x} cy={last.y} r={3} fill="currentColor" />
        </svg>
      )}
      <figcaption className="text-sm tabular-nums text-muted-foreground">
        {`En esta página: mín. ${formatRate(summary.min)} · máx. ${formatRate(summary.max)} · último ${formatRate(summary.last)}`}
      </figcaption>
    </figure>
  );
}
