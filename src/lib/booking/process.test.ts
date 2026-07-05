import { describe, it, expect, vi } from 'vitest';
import { processBooking, type BookingDeps } from './process';
import type { PaymentInput } from '@/lib/schemas';

const input: PaymentInput = {
  date: '2030-01-15', adults: 2, children: 1,
  firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
  idType: 'V', idNumber: '12345678', phone: '04141234567',
  bankCode: '0105', otp: '12345678',
};

function deps(overrides: Partial<BookingDeps> = {}): BookingDeps {
  return {
    getPrices: vi.fn(async () => ({ adult: 15, child: 5 })),
    reserve: vi.fn(async () => ({ ok: true as const, id: 'uuid-1', code: 'PP-AAAAA' })),
    getRate: vi.fn(async () => 36.5),
    pay: vi.fn(async () => ({ status: 'approved' as const, reference: 'REF-1' })),
    confirm: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    sendVoucher: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('processBooking', () => {
  it('happy path: reserves, charges 35 USD → VES, confirms, sends voucher', async () => {
    const d = deps();
    const res = await processBooking(input, d);
    expect(res).toEqual({
      ok: true,
      reservation: { id: 'uuid-1', code: 'PP-AAAAA', totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5 },
    });
    expect(d.pay).toHaveBeenCalledWith(expect.objectContaining({ amountVes: 1277.5, invoiceNumber: 'PP-AAAAA' }));
    expect(d.confirm).toHaveBeenCalledWith('uuid-1', { bcvRate: 36.5, totalVes: 1277.5, paymentRef: 'REF-1' });
    expect(d.sendVoucher).toHaveBeenCalled();
  });

  it('rejects invalid input without touching any dependency', async () => {
    const d = deps();
    const res = await processBooking({ ...input, phone: 'bad' }, d);
    expect(res).toMatchObject({ ok: false, error: 'validation' });
    expect(d.reserve).not.toHaveBeenCalled();
  });

  it('capacity full: returns remaining, does not charge', async () => {
    const d = deps({ reserve: vi.fn(async () => ({ ok: false as const, remaining: 2 })) });
    const res = await processBooking(input, d);
    expect(res).toEqual({ ok: false, error: 'capacity', remaining: 2 });
    expect(d.pay).not.toHaveBeenCalled();
  });

  it('no acceptable BCV rate: fails the reservation, never charges', async () => {
    const d = deps({ getRate: vi.fn(async () => null) });
    const res = await processBooking(input, d);
    expect(res).toMatchObject({ ok: false, error: 'rate_unavailable' });
    expect(d.fail).toHaveBeenCalledWith('uuid-1');
    expect(d.pay).not.toHaveBeenCalled();
  });

  it('declined payment: fails the reservation (releases capacity)', async () => {
    const d = deps({ pay: vi.fn(async () => ({ status: 'declined' as const, message: 'Clave inválida' })) });
    const res = await processBooking(input, d);
    expect(res).toEqual({ ok: false, error: 'payment_declined', message: 'Clave inválida' });
    expect(d.fail).toHaveBeenCalledWith('uuid-1');
  });

  it('ambiguous payment (timeout): keeps reservation pending, does NOT fail it', async () => {
    const d = deps({ pay: vi.fn(async () => ({ status: 'unknown' as const, message: 'ETIMEDOUT' })) });
    const res = await processBooking(input, d);
    expect(res).toMatchObject({ ok: false, error: 'payment_pending' });
    expect(d.fail).not.toHaveBeenCalled();
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it('voucher email failure does not break a confirmed booking', async () => {
    const d = deps({ sendVoucher: vi.fn(async () => { throw new Error('resend down'); }) });
    const res = await processBooking(input, d);
    expect(res).toMatchObject({ ok: true });
  });

  it('fail() throwing (reservation already resolved) does not mask the user-facing error', async () => {
    const d = deps({
      pay: vi.fn(async () => ({ status: 'declined' as const, message: 'Clave inválida' })),
      fail: vi.fn(async () => { throw new Error('reservation not in expected status'); }),
    });
    const res = await processBooking(input, d);
    expect(res).toEqual({ ok: false, error: 'payment_declined', message: 'Clave inválida' });
  });
});
