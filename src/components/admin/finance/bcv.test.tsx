// src/components/admin/finance/bcv.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { BcvRowWithVariation } from '@/lib/finance/bcv';
import { BcvSparkline } from './bcv-sparkline';
import { BcvHistoryList } from './bcv-history-list';

const r = (id: number, rate: number, variationPct: number | null, source: string | null = 'auto'): BcvRowWithVariation => ({
  id, rate, source, variationPct, fetched_at: `2026-10-0${id}T13:00:00Z`,
});

// Newest first, like the action returns them.
const rows = [r(3, 37, 1.369863, 'manual'), r(2, 36.5, 0), r(1, 36.5, null, null)];

describe('BcvSparkline', () => {
  it('draws the page oldest→newest and summarizes it in text', () => {
    render(<BcvSparkline rows={rows} />);
    const svg = screen.getByTestId('bcv-sparkline');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // 3 points, newest (37 = max) on the right at the top.
    expect(svg.querySelector('polyline')).toHaveAttribute('points', '2,46 120,46 238,2');
    expect(svg.querySelector('circle')).toHaveAttribute('cx', '238');
    expect(screen.getByText('En esta página: mín. Bs. 36.5000 · máx. Bs. 37.0000 · último Bs. 37.0000')).toBeInTheDocument();
  });

  it('skips the line with a single rate but keeps the summary', () => {
    render(<BcvSparkline rows={[r(1, 36.5, null)]} />);
    expect(screen.queryByTestId('bcv-sparkline')).toBeNull();
    expect(screen.getByText(/último Bs\. 36\.5000/)).toBeInTheDocument();
  });

  it('renders nothing without rows', () => {
    const { container } = render(<BcvSparkline rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('BcvHistoryList', () => {
  it('renders a table with Caracas time, rate, source chip and variation', () => {
    render(<BcvHistoryList rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha (Caracas)', 'Tasa', 'Origen', 'Variación',
    ]);
    const [, newest, middle, oldest] = within(table).getAllByRole('row');
    expect(within(newest).getByText('03/10/2026 09:00')).toBeInTheDocument();
    expect(within(newest).getByText('Bs. 37.0000')).toBeInTheDocument();
    expect(within(newest).getByText('Manual')).toHaveClass('bg-sky-100');
    expect(within(newest).getByText('+1.37 %')).toHaveClass('text-amber-700');
    expect(within(middle).getByText('Automática')).toBeInTheDocument();
    expect(within(middle).getByText('0.00 %')).toBeInTheDocument();
    expect(within(oldest).getByText('Sin origen')).toBeInTheDocument();
    expect(within(oldest).getByText('—')).toHaveAttribute('title', 'Sin registro anterior');
  });

  it('renders one card per rate for mobile', () => {
    render(<BcvHistoryList rows={rows} />);
    const cards = screen.getAllByTestId('bcv-card');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText('+1.37 %')).toBeInTheDocument();
  });
});
