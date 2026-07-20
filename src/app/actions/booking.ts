'use server';

import { headers } from 'next/headers';
import { processBooking, type BookingResult } from '@/lib/booking/process';
import { getBcvRate, fetchBcvRate } from '@/lib/bcv';
import { payC2p, mercantilConfigFromEnv } from '@/lib/mercantil/client';
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability,
} from '@/lib/db/reservations';
import { checkRateLimit } from '@/lib/db/rate-limit';
import { sendVoucherEmail } from '@/lib/email/send';
import { todayCaracas } from '@/lib/dates';

// Public booking action: at most 8 attempts per IP per minute. A pending
// reservation holds a slot for 10 min, so unthrottled spam could exhaust
// daily capacity; this caps that abuse while leaving room for honest retries.
const BOOKING_MAX_PER_MINUTE = 8;

export async function submitBookingAndPay(raw: unknown): Promise<BookingResult> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const allowed = await checkRateLimit(`book:${ip}`, BOOKING_MAX_PER_MINUTE, 60);
  if (!allowed) {
    return {
      ok: false, error: 'rate_limited',
      message: 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.',
    };
  }

  return processBooking(raw, {
    getPrices: async () => {
      const s = await getSettings();
      return { adult: Number(s.adult_price_usd), child: Number(s.child_price_usd) };
    },
    reserve: reserveSlots,
    getRate: () =>
      getBcvRate({
        fetchRate: fetchBcvRate,
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

export async function getCurrentRate(): Promise<number | null> {
  return getBcvRate({
    fetchRate: fetchBcvRate,
    readCache: readRateCache,
    writeCache: writeRateCache,
    now: Date.now,
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

/** Remaining slots for today (Caracas). Absent key in monthAvailability = default capacity free. */
export async function getTodayRemaining(): Promise<number> {
  const today = todayCaracas();
  const avail = await monthAvailability(today.slice(0, 7));
  if (avail[today] !== undefined) return avail[today];
  const s = await getSettings();
  return s.daily_capacity;
}
