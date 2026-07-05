import { paymentSchema } from '@/lib/schemas';
import { totalUsd, usdToVes } from '@/lib/money';
import type { C2pRequest, C2pResult } from '@/lib/mercantil/client';
import type { ReserveResult } from '@/lib/db/reservations';

export interface VoucherData {
  reservationId: string; code: string; email: string;
  firstName: string; lastName: string; idType: string; idNumber: string;
  date: string; adults: number; children: number;
  totalUsd: number; totalVes: number; bcvRate: number;
}

export interface BookingDeps {
  getPrices: () => Promise<{ adult: number; child: number }>;
  reserve: (input: {
    date: string; firstName: string; lastName: string; email: string;
    idType: 'V' | 'E' | 'P' | 'J'; idNumber: string;
    adults: number; children: number; totalUsd: number;
  }) => Promise<ReserveResult>;
  getRate: () => Promise<number | null>;
  pay: (req: C2pRequest) => Promise<C2pResult>;
  confirm: (id: string, p: { bcvRate: number; totalVes: number; paymentRef: string }) => Promise<void>;
  fail: (id: string) => Promise<void>;
  sendVoucher: (v: VoucherData) => Promise<void>;
}

export type BookingResult =
  | { ok: true; reservation: { id: string; code: string; totalUsd: number; totalVes: number; bcvRate: number } }
  | { ok: false; error: 'validation'; message: string }
  | { ok: false; error: 'capacity'; remaining: number }
  | { ok: false; error: 'rate_unavailable'; message: string }
  | { ok: false; error: 'payment_declined'; message: string }
  | { ok: false; error: 'payment_pending'; message: string };

/** Releases capacity; tolerates the reservation already having left pending state. */
async function safeFail(deps: BookingDeps, id: string): Promise<void> {
  try {
    await deps.fail(id);
  } catch (e) {
    console.error('booking: failReservation skipped:', e);
  }
}

export async function processBooking(raw: unknown, deps: BookingDeps): Promise<BookingResult> {
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'validation', message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }
  const input = parsed.data;

  const prices = await deps.getPrices();
  const usd = totalUsd(input.adults, input.children, prices);

  const reserved = await deps.reserve({
    date: input.date, firstName: input.firstName, lastName: input.lastName,
    email: input.email, idType: input.idType, idNumber: input.idNumber,
    adults: input.adults, children: input.children, totalUsd: usd,
  });
  if (!reserved.ok) return { ok: false, error: 'capacity', remaining: reserved.remaining };

  const rate = await deps.getRate();
  if (rate === null) {
    await safeFail(deps, reserved.id);
    return {
      ok: false, error: 'rate_unavailable',
      message: 'No pudimos obtener la tasa BCV. Intenta de nuevo más tarde.',
    };
  }
  const ves = usdToVes(usd, rate);

  const payment = await deps.pay({
    amountVes: ves,
    destinationBankCode: input.bankCode,
    destinationId: `${input.idType}${input.idNumber}`,
    destinationPhone: input.phone,
    otp: input.otp,
    invoiceNumber: reserved.code,
  });

  if (payment.status === 'declined') {
    await safeFail(deps, reserved.id);
    return { ok: false, error: 'payment_declined', message: payment.message };
  }
  if (payment.status === 'unknown') {
    // Ambiguous: may have charged. Keep pending; admin verifies manually. Never auto-retry.
    return {
      ok: false, error: 'payment_pending',
      message: 'Tu pago está siendo verificado. Te contactaremos con la confirmación.',
    };
  }

  await deps.confirm(reserved.id, { bcvRate: rate, totalVes: ves, paymentRef: payment.reference });

  try {
    await deps.sendVoucher({
      reservationId: reserved.id, code: reserved.code, email: input.email,
      firstName: input.firstName, lastName: input.lastName,
      idType: input.idType, idNumber: input.idNumber,
      date: input.date, adults: input.adults, children: input.children,
      totalUsd: usd, totalVes: ves, bcvRate: rate,
    });
  } catch (e) {
    console.error('voucher email failed (booking still confirmed):', e);
  }

  return { ok: true, reservation: { id: reserved.id, code: reserved.code, totalUsd: usd, totalVes: ves, bcvRate: rate } };
}
