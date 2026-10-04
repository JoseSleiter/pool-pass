'use server';

import { headers } from 'next/headers';
import { processBooking, type BookingResult } from '@/lib/booking/process';
import { getBcvRate, fetchBcvRate, type RateDeps } from '@/lib/bcv';
import { recordBcvRate } from '@/lib/bcv-history';
import { payC2p, mercantilConfigFromEnv } from '@/lib/mercantil/client';
import {
  reserveSlots, confirmReservation, failReservation,
  getSettings, readRateCache, writeRateCache, monthAvailability, sumPartySize,
  listOverrides,
} from '@/lib/db/reservations';
import type { TodayCapacity } from '@/lib/availability';
import { checkRateLimit } from '@/lib/db/rate-limit';
import { sendVoucherEmail } from '@/lib/email/send';
import { todayCaracas, upcomingWeekend } from '@/lib/dates';

// Public booking action: at most 8 attempts per IP per minute. A pending
// reservation holds a slot for 10 min, so unthrottled spam could exhaust
// daily capacity; this caps that abuse while leaving room for honest retries.
const BOOKING_MAX_PER_MINUTE = 8;

// Shared BCV deps. A fresh fetch refreshes the settings cache AND appends a
// bcv_rate_history row ('auto' = triggered by app traffic, not the admin).
function rateDeps(): RateDeps {
  return {
    fetchRate: fetchBcvRate,
    readCache: readRateCache,
    writeCache: writeRateCache,
    recordHistory: (rate, fetchedAt) => recordBcvRate(rate, fetchedAt, 'auto'),
    now: Date.now,
  };
}

// Social proof on the landing ("N personas reservadas este fin de semana") is shown
// only with real numbers, and hidden below this many people.
const WEEKEND_SOCIAL_PROOF_MIN = 10;

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
    getRate: () => getBcvRate(rateDeps()),
    pay: (req) => payC2p(req, mercantilConfigFromEnv()),
    confirm: confirmReservation,
    fail: failReservation,
    sendVoucher: sendVoucherEmail,
  });
}

export async function getCurrentRate(): Promise<number | null> {
  return getBcvRate(rateDeps());
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

/**
 * Today's (Caracas) live numbers for the landing hero: remaining slots, today's
 * capacity (the day's override, else the default) and the default daily
 * capacity, which is what any day absent from monthAvailability has free.
 */
export async function getTodayCapacity(): Promise<TodayCapacity> {
  const today = todayCaracas();
  const [avail, settings, overrides] = await Promise.all([
    monthAvailability(today.slice(0, 7)),
    getSettings(),
    listOverrides(),
  ]);
  const dailyCapacity = settings.daily_capacity;
  const capacity = overrides.find((o) => o.date === today)?.capacity ?? dailyCapacity;
  return { remaining: avail[today] ?? capacity, capacity, dailyCapacity };
}

/**
 * People (adults + children) with a confirmed or checked-in booking for the
 * upcoming Saturday + Sunday in Caracas time (the current weekend on Sat/Sun).
 * null when below WEEKEND_SOCIAL_PROOF_MIN or on any error — the landing must
 * never break or show a made-up number because of this.
 */
export async function getWeekendBookedPeople(): Promise<number | null> {
  try {
    const { saturday, sunday } = upcomingWeekend(todayCaracas());
    const people = await sumPartySize({
      dateFrom: saturday, dateTo: sunday, statuses: ['confirmed', 'checked_in'],
    });
    return people >= WEEKEND_SOCIAL_PROOF_MIN ? people : null;
  } catch (e) {
    console.error('getWeekendBookedPeople failed', e);
    return null;
  }
}
