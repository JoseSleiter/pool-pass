import { describe, it, expect } from 'vitest';
import type { VoucherData } from '@/lib/booking/process';
import { voucherText } from './voucher-text';

const voucher: VoucherData = {
  reservationId: 'uuid-1', code: 'PP-4F7K2', email: 'ana@example.com',
  firstName: 'Ana', lastName: 'Pérez', idType: 'V', idNumber: '12345678',
  date: '2030-01-15', adults: 2, children: 1,
  totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5,
};

describe('voucherText', () => {
  it('carries every field the gate needs', () => {
    const text = voucherText(voucher);
    for (const expected of [
      'PP-4F7K2', 'Ana Pérez', 'V-12345678',
      '2 adultos, 1 niño', '$35.00', 'Bs. 1277.50', '36.50',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('renders the visit date the way the subject does, not as an ISO string', () => {
    const text = voucherText(voucher);
    expect(text).toContain('Mar, 15 Ene 2030');
    expect(text).not.toContain('2030-01-15');
  });

  it('never leaks the admin check-in URL into a guest-facing body', () => {
    // checkInUrl() resolves to /admin/checkin/:id. It belongs in the QR image
    // only: printing it would hand every guest a readable admin link.
    expect(voucherText(voucher)).not.toContain('/admin/');
  });

  it('offers a way to reach the club', () => {
    const text = voucherText(voucher);
    expect(text).toContain('https://wa.me/584249196984');
    expect(text).toContain('https://instagram.com/finca_villa_victoria');
  });
});
