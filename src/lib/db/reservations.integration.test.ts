import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  reserveSlots, confirmReservation, failReservation,
  getReservation, checkInReservation, monthAvailability,
  getSettings, readRateCache, writeRateCache,
  updateSettings, listOverrides, upsertOverride, deleteOverride,
} from './reservations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as never } }
);
const DATE = '2030-02-10';

const input = {
  date: DATE, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
  idType: 'V' as const, idNumber: '12345678', adults: 2, children: 1, totalUsd: 35,
};

describe('reservations data layer', () => {
  beforeEach(async () => {
    await supabase.from('reservations').delete().eq('date', DATE);
    await supabase.from('capacity_overrides').delete().eq('date', DATE);
  });

  it('reserveSlots returns id+code on success and remaining on capacity error', async () => {
    const ok = await reserveSlots(input);
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.code).toMatch(/^PP-/);

    await supabase.from('capacity_overrides').insert({ date: DATE, capacity: 3 });
    const full = await reserveSlots(input); // 3 already pending, +3 > 3
    expect(full).toEqual({ ok: false, remaining: 0 });
  });

  it('confirm → getReservation shows confirmed with totals; checkIn stamps time', async () => {
    const r = await reserveSlots(input);
    if (!r.ok) throw new Error('setup failed');
    await confirmReservation(r.id, { bcvRate: 36.5, totalVes: 1277.5, paymentRef: 'REF-9' });
    let row = await getReservation(r.id);
    expect(row!.status).toBe('confirmed');
    expect(Number(row!.total_ves)).toBe(1277.5);
    await checkInReservation(r.id);
    row = await getReservation(r.id);
    expect(row!.status).toBe('checked_in');
    expect(row!.checked_in_at).toBeTruthy();
  });

  it('failReservation releases capacity', async () => {
    await supabase.from('capacity_overrides').insert({ date: DATE, capacity: 3 });
    const r = await reserveSlots(input);
    if (!r.ok) throw new Error('setup failed');
    await failReservation(r.id);
    const again = await reserveSlots(input);
    expect(again.ok).toBe(true);
  });

  it('monthAvailability reports remaining per date within the month', async () => {
    await supabase.from('capacity_overrides').insert({ date: DATE, capacity: 10 });
    const r = await reserveSlots(input); // 3 people pending
    if (!r.ok) throw new Error('setup failed');
    const avail = await monthAvailability('2030-02');
    expect(avail[DATE]).toBe(7);
  });

  it('checkInReservation rejects while still pending_payment', async () => {
    const r = await reserveSlots(input);
    if (!r.ok) throw new Error('setup failed');
    await expect(checkInReservation(r.id)).rejects.toThrow();
    const row = await getReservation(r.id);
    expect(row!.status).toBe('pending_payment');
    expect(row!.checked_in_at).toBeNull();
  });

  it('confirmReservation rejects on a failed reservation', async () => {
    const r = await reserveSlots(input);
    if (!r.ok) throw new Error('setup failed');
    await failReservation(r.id);
    await expect(
      confirmReservation(r.id, { bcvRate: 36.5, totalVes: 1277.5, paymentRef: 'REF-9' })
    ).rejects.toThrow();
    const row = await getReservation(r.id);
    expect(row!.status).toBe('failed');
  });

  it('double checkInReservation rejects on the second call', async () => {
    const r = await reserveSlots(input);
    if (!r.ok) throw new Error('setup failed');
    await confirmReservation(r.id, { bcvRate: 36.5, totalVes: 1277.5, paymentRef: 'REF-9' });
    await checkInReservation(r.id);
    await expect(checkInReservation(r.id)).rejects.toThrow();
    const row = await getReservation(r.id);
    expect(row!.status).toBe('checked_in');
  });

  it('rate cache round-trips through settings', async () => {
    await writeRateCache(36.77, Date.parse('2030-02-10T12:00:00Z'));
    const cached = await readRateCache();
    expect(cached).toEqual({ rate: 36.77, fetchedAt: Date.parse('2030-02-10T12:00:00Z') });
    const settings = await getSettings();
    expect(settings.daily_capacity).toBeGreaterThan(0);
  });
});

describe('settings & capacity override helpers', () => {
  const OV_DATE = '2030-03-05';

  beforeEach(async () => {
    await supabase.from('capacity_overrides').delete().eq('date', OV_DATE);
  });

  it('upsertOverride creates then updates a row visible via listOverrides', async () => {
    await upsertOverride(OV_DATE, 5);
    let overrides = await listOverrides();
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 5 });

    await upsertOverride(OV_DATE, 0);
    overrides = await listOverrides();
    expect(overrides).toContainEqual({ date: OV_DATE, capacity: 0 });
  });

  it('deleteOverride removes the row', async () => {
    await upsertOverride(OV_DATE, 5);
    await deleteOverride(OV_DATE);
    const overrides = await listOverrides();
    expect(overrides.find((o) => o.date === OV_DATE)).toBeUndefined();
  });

  it('updateSettings round-trips via getSettings, then restores original values', async () => {
    const original = await getSettings();
    try {
      await updateSettings({ daily_capacity: 42, adult_price_usd: 12.5, child_price_usd: 6.25 });
      const updated = await getSettings();
      expect(updated.daily_capacity).toBe(42);
      expect(Number(updated.adult_price_usd)).toBe(12.5);
      expect(Number(updated.child_price_usd)).toBe(6.25);
    } finally {
      await updateSettings({
        daily_capacity: original.daily_capacity,
        adult_price_usd: Number(original.adult_price_usd),
        child_price_usd: Number(original.child_price_usd),
      });
    }
  });
});
