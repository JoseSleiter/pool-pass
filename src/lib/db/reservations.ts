import { serviceClient } from './service-client';

export interface ReserveInput {
  date: string; firstName: string; lastName: string; email: string;
  idType: 'V' | 'E' | 'P' | 'J'; idNumber: string;
  adults: number; children: number; totalUsd: number;
}

export type ReserveResult =
  | { ok: true; id: string; code: string }
  | { ok: false; remaining: number };

export interface ReservationRow {
  id: string; code: string; date: string;
  first_name: string; last_name: string; email: string;
  id_type: string; id_number: string;
  adults: number; children: number;
  total_usd: number; bcv_rate: number | null; total_ves: number | null;
  status: 'pending_payment' | 'confirmed' | 'failed' | 'expired' | 'checked_in';
  payment_ref: string | null; expires_at: string | null;
  checked_in_at: string | null; created_at: string;
}

export interface ReservationQuery {
  dateFrom?: string; dateTo?: string;           // YYYY-MM-DD, inclusive
  statuses?: ReservationRow['status'][];
  q?: string;                                    // nombre, apellido, código PP-XXXX o número de documento
  guestType?: 'individual' | 'family';
  sort?: { by: 'date' | 'code' | 'name' | 'guests' | 'total_usd' | 'status'; dir: 'asc' | 'desc' };
  page: number;                                  // 1-based
  pageSize: 10 | 25 | 50;
}

export interface SettingsRow {
  daily_capacity: number;
  adult_price_usd: number;
  child_price_usd: number;
  last_bcv_rate: number | null;
  last_bcv_rate_at: string | null;
}

interface ReserveSlotsRow {
  ok: boolean;
  reservation_id: string;
  code: string;
  remaining: number;
}

export async function reserveSlots(input: ReserveInput): Promise<ReserveResult> {
  const { data, error } = await serviceClient().rpc('reserve_slots', {
    p_date: input.date,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_id_type: input.idType,
    p_id_number: input.idNumber,
    p_adults: input.adults,
    p_children: input.children,
    p_total_usd: input.totalUsd,
  });
  if (error) throw new Error(`reserve_slots: ${error.message}`);
  const row = (data as ReserveSlotsRow[])[0];
  return row.ok
    ? { ok: true, id: row.reservation_id, code: row.code }
    : { ok: false, remaining: row.remaining };
}

export async function confirmReservation(
  id: string,
  p: { bcvRate: number; totalVes: number; paymentRef: string }
): Promise<void> {
  const { data, error } = await serviceClient()
    .from('reservations')
    .update({ status: 'confirmed', bcv_rate: p.bcvRate, total_ves: p.totalVes, payment_ref: p.paymentRef })
    .eq('id', id)
    .eq('status', 'pending_payment')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('reservation not in expected status');
}

export async function failReservation(id: string): Promise<void> {
  const { data, error } = await serviceClient()
    .from('reservations')
    .update({ status: 'failed' })
    .eq('id', id)
    .eq('status', 'pending_payment')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('reservation not in expected status');
}

export async function checkInReservation(id: string): Promise<void> {
  const { data, error } = await serviceClient()
    .from('reservations')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'confirmed')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('reservation not in expected status');
}

export async function getReservation(id: string): Promise<ReservationRow | null> {
  const { data, error } = await serviceClient()
    .from('reservations').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listReservationsByDate(date: string): Promise<ReservationRow[]> {
  const { data, error } = await serviceClient()
    .from('reservations').select('*').eq('date', date)
    .in('status', ['pending_payment', 'confirmed', 'checked_in'])
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSettings(): Promise<SettingsRow> {
  const { data, error } = await serviceClient()
    .from('settings').select('*').eq('id', 1).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function readRateCache(): Promise<{ rate: number; fetchedAt: number } | null> {
  const s = await getSettings();
  if (s.last_bcv_rate == null || s.last_bcv_rate_at == null) return null;
  return { rate: Number(s.last_bcv_rate), fetchedAt: Date.parse(s.last_bcv_rate_at) };
}

export async function writeRateCache(rate: number, fetchedAt: number): Promise<void> {
  const { error } = await serviceClient()
    .from('settings')
    .update({ last_bcv_rate: rate, last_bcv_rate_at: new Date(fetchedAt).toISOString() })
    .eq('id', 1);
  if (error) throw new Error(error.message);
}

/** Remaining capacity per day for a month ('YYYY-MM'). Missing key = default capacity untouched. */
export async function monthAvailability(month: string): Promise<Record<string, number>> {
  const db = serviceClient();
  const first = `${month}-01`;
  const last = new Date(Date.UTC(
    Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0
  )).toISOString().slice(0, 10);

  const [settings, overridesRes, rowsRes] = await Promise.all([
    getSettings(),
    db.from('capacity_overrides').select('*').gte('date', first).lte('date', last),
    db.from('reservations')
      .select('date, adults, children, status, expires_at')
      .gte('date', first).lte('date', last)
      .in('status', ['pending_payment', 'confirmed', 'checked_in']),
  ]);
  if (overridesRes.error) throw new Error(overridesRes.error.message);
  if (rowsRes.error) throw new Error(rowsRes.error.message);

  const now = Date.now();
  const occupancy: Record<string, number> = {};
  for (const r of rowsRes.data) {
    const counts =
      r.status !== 'pending_payment' ||
      (r.expires_at !== null && Date.parse(r.expires_at) > now);
    if (counts) occupancy[r.date] = (occupancy[r.date] ?? 0) + r.adults + r.children;
  }

  const result: Record<string, number> = {};
  const overrides = new Map(overridesRes.data.map((o) => [o.date, o.capacity]));
  const dates = new Set([...Object.keys(occupancy), ...overrides.keys()]);
  for (const date of dates) {
    const limit = overrides.get(date) ?? settings.daily_capacity;
    result[date] = Math.max(limit - (occupancy[date] ?? 0), 0);
  }
  return result;
}

export async function updateSettings(p: {
  daily_capacity: number; adult_price_usd: number; child_price_usd: number;
}): Promise<void> {
  const { error } = await serviceClient().from('settings').update(p).eq('id', 1);
  if (error) throw new Error(error.message);
}

export interface OverrideRow {
  date: string;
  capacity: number;
  reason: string | null;
}

export async function listOverrides(): Promise<OverrideRow[]> {
  const { data, error } = await serviceClient()
    .from('capacity_overrides').select('date, capacity, reason').order('date');
  if (error) throw new Error(error.message);
  return data as OverrideRow[];
}

export async function upsertOverride(date: string, capacity: number, reason?: string | null): Promise<void> {
  const { error } = await serviceClient()
    .from('capacity_overrides').upsert({ date, capacity, reason: reason ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteOverride(date: string): Promise<void> {
  const { error } = await serviceClient()
    .from('capacity_overrides').delete().eq('date', date);
  if (error) throw new Error(error.message);
}
