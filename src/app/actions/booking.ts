'use server';

import { processBooking, type BookingResult } from '@/lib/booking/process';
import { getBcvRate, fetchBcvRateFromMirror } from '@/lib/bcv';
import { payC2p, mercantilConfigFromEnv } from '@/lib/mercantil/client';
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';

export async function submitBookingAndPay(raw: unknown): Promise<BookingResult> {
  return processBooking(raw, {
    getPrices: async () => {
      const s = await getSettings();
      return { adult: Number(s.adult_price_usd), child: Number(s.child_price_usd) };
    },
    reserve: reserveSlots,
    getRate: () =>
      getBcvRate({
        fetchRate: fetchBcvRateFromMirror,
        readCache: readRateCache,
        writeCache: writeRateCache,
        now: Date.now,
      }),
    pay: (req) => payC2p(req, mercantilConfigFromEnv()),
    confirm: confirmReservation,
    fail: failReservation,
    sendVoucher: sendVoucherEmail,
  });
}

export async function getAvailability(month: string): Promise<Record<string, number>> {
  if (!/^\d{4}-\d{2}$/.test(month)) return {};
  return monthAvailability(month);
}

export async function getPublicPrices(): Promise<{ adult: number; child: number }> {
  const s = await getSettings();
  return { adult: Number(s.adult_price_usd), child: Number(s.child_price_usd) };
}
