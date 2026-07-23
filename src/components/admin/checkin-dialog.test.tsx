// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinDialog } from './checkin-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

const TODAY = '2030-01-15';
function row(over: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', code: 'PP-KAV8W', date: TODAY,
    first_name: 'Jose', last_name: 'Rios', email: 'j@e.com',
    id_type: 'V', id_number: '262626262', adults: 1, children: 0,
    total_usd: 15, bcv_rate: 36.5, total_ves: 547.5,
    status: 'confirmed', payment_ref: 'REF', expires_at: null,
    checked_in_at: null, created_at: '2030-01-10T10:00:00Z', ...over,
  };
}

describe('CheckinDialog', () => {
  it('warns when reservation date is not today', () => {
    render(<CheckinDialog reservation={row({ date: '2030-01-20' })} today={TODAY} open onOpenChange={() => {}} onApprove={vi.fn()} />);
    expect(screen.getByText(/fecha distinta/i)).toBeInTheDocument();
  });
  it('calls onApprove when approving', async () => {
    const onApprove = vi.fn().mockResolvedValue({ ok: true });
    render(<CheckinDialog reservation={row()} today={TODAY} open onOpenChange={() => {}} onApprove={onApprove} />);
    await userEvent.click(screen.getByRole('button', { name: /Aprobar check-in/i }));
    expect(onApprove).toHaveBeenCalledWith(row().id);
  });
});
