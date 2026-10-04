// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricGrid } from './metric-cards';
import type { DaySummary } from '@/app/admin/actions';

const summary: DaySummary = {
  capacity: 100, confirmedPeople: 5, checkedInParties: 1, checkedInPeople: 1,
  revenueUsd: 65, revenueVes: 2390.05, paidCount: 2, pendingCount: 0,
  checkinsByHour: [],
};

describe('MetricGrid', () => {
  it('shows occupancy, arrivals, revenue and "Todo al día" when no pending', () => {
    render(<MetricGrid summary={summary} onReviewPending={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/\/100/)).toBeInTheDocument();
    expect(screen.getByText('$65.00')).toBeInTheDocument();
    expect(screen.getByText(/Todo al día/i)).toBeInTheDocument();
  });
  it('shows "Requiere atención" and a review button when pending > 0', () => {
    render(<MetricGrid summary={{ ...summary, pendingCount: 3 }} onReviewPending={() => {}} />);
    expect(screen.getByText(/Requiere atención/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revisar pagos/i })).toBeInTheDocument();
  });
});
