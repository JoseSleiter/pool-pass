'use server';

import { revalidatePath } from 'next/cache';
import { ssrClient } from '@/lib/db/ssr-client';
import {
  listReservationsByDate, getReservation, checkInReservation,
  getSettings, type ReservationRow,
} from '@/lib/db/reservations';
import { sendVoucherEmail } from '@/lib/email/send';

/** SECURITY: middleware only guards pages — every admin action MUST call this first. */
async function requireAdmin(): Promise<void> {
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
}

export async function adminListReservations(date: string): Promise<ReservationRow[]> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  return listReservationsByDate(date);
}

export async function adminGetDaySummary(date: string) {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const [rows, settings] = await Promise.all([listReservationsByDate(date), getSettings()]);
  const active = rows.filter((r) => ['confirmed', 'checked_in'].includes(r.status));
  return {
    capacity: settings.daily_capacity,
    confirmedPeople: active.reduce((s, r) => s + r.adults + r.children, 0),
    checkedInParties: rows.filter((r) => r.status === 'checked_in').length,
  };
}

export async function adminCheckIn(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
  try {
    await checkInReservation(id);
    revalidatePath('/admin');
    return { ok: true };
  } catch {
    // status guard: reservation not confirmed (already checked in, pending, failed…)
    return { ok: false, message: 'La reserva no está en estado confirmado.' };
  }
}

export async function adminResendVoucher(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireAdmin();
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
    return { ok: true };
  } catch {
    return { ok: false, message: 'No se pudo reenviar el correo.' };
  }
}
