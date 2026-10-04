'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
  listReservationsByDate, getReservation, checkInReservation,
  getSettings, updateSettings, listOverrides, upsertOverride, deleteOverride,
  type ReservationRow,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';
import { logAudit } from '@/lib/audit';

export interface DaySummary {
  capacity: number;
  confirmedPeople: number;
  checkedInParties: number;
  checkedInPeople: number;
  revenueUsd: number;
  revenueVes: number;
  paidCount: number;
  pendingCount: number;
}

export async function adminListReservations(date: string): Promise<ReservationRow[]> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  return listReservationsByDate(date);
}

export async function adminGetDaySummary(date: string): Promise<DaySummary> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const [rows, settings] = await Promise.all([listReservationsByDate(date), getSettings()]);
  const paid = rows.filter((r) => ['confirmed', 'checked_in'].includes(r.status));
  const checkedIn = rows.filter((r) => r.status === 'checked_in');
  return {
    capacity: settings.daily_capacity,
    confirmedPeople: paid.reduce((s, r) => s + r.adults + r.children, 0),
    checkedInParties: checkedIn.length,
    checkedInPeople: checkedIn.reduce((s, r) => s + r.adults + r.children, 0),
    revenueUsd: paid.reduce((s, r) => s + Number(r.total_usd), 0),
    revenueVes: paid.reduce((s, r) => s + Number(r.total_ves ?? 0), 0),
    paidCount: paid.length,
    pendingCount: rows.filter((r) => r.status === 'pending_payment').length,
  };
}

export async function adminCheckIn(id: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin();
  try {
    await checkInReservation(id);
  } catch {
    // status guard: reservation not confirmed (already checked in, pending, failed…)
    return { ok: false, message: 'La reserva no está en estado confirmado.' };
  }
  await logAudit({ actor: me.email, action: 'reservation.check_in', target: id });
  revalidatePath('/admin');
  return { ok: true };
}

export async function adminResendVoucher(id: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin();
  let code: string;
  try {
    const r = await getReservation(id);
    if (!r || !['confirmed', 'checked_in'].includes(r.status)) {
      return { ok: false, message: 'Reserva no reenviable.' };
    }
    await sendVoucherEmail({
      reservationId: r.id, code: r.code, email: r.email,
      firstName: r.first_name, lastName: r.last_name,
      idType: r.id_type, idNumber: r.id_number,
      date: r.date, adults: r.adults, children: r.children,
      totalUsd: Number(r.total_usd), totalVes: Number(r.total_ves ?? 0), bcvRate: Number(r.bcv_rate ?? 0),
    });
    code = r.code;
  } catch {
    return { ok: false, message: 'No se pudo reenviar el correo.' };
  }
  await logAudit({ actor: me.email, action: 'reservation.resend_voucher', target: id, details: { code } });
  return { ok: true };
}

const settingsSchema = z.object({
  daily_capacity: z.number().int().min(0).max(10000),
  adult_price_usd: z.number().min(0).max(1000),
  child_price_usd: z.number().min(0).max(1000),
});

export async function adminGetSettings() {
  await requireAdmin({ role: 'owner' });
  const [settings, overrides] = await Promise.all([getSettings(), listOverrides()]);
  return { settings, overrides };
}

export async function adminUpdateSettings(raw: unknown): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Valores inválidos.' };
  try {
    await updateSettings(parsed.data);
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
  await logAudit({ actor: me.email, action: 'settings.update', details: parsed.data });
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function adminUpsertOverride(
  date: string,
  capacity: number,
  reason?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  const cleanReason = typeof reason === 'string' ? reason.trim().slice(0, 200) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(capacity) || capacity < 0 || capacity > 10000) {
    return { ok: false, message: 'Valores inválidos.' };
  }
  try {
    await upsertOverride(date, capacity, cleanReason || null);
  } catch {
    return { ok: false, message: 'No se pudo guardar.' };
  }
  await logAudit({
    actor: me.email, action: 'override.upsert', target: date,
    details: { capacity, reason: cleanReason || null },
  });
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function adminDeleteOverride(date: string): Promise<{ ok: boolean; message?: string }> {
  const me = await requireAdmin({ role: 'owner' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: 'Fecha inválida.' };
  try {
    await deleteOverride(date);
  } catch {
    return { ok: false, message: 'No se pudo eliminar.' };
  }
  await logAudit({ actor: me.email, action: 'override.delete', target: date });
  revalidatePath('/admin/settings');
  return { ok: true };
}
