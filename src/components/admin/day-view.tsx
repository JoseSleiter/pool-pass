'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { ReservationsTable } from './reservations-table';
import { adminCheckIn, adminResendVoucher } from '@/app/admin/actions';
import type { ReservationRow } from '@/lib/db/reservations';

export function AdminDayView(props: {
  date: string;
  rows: ReservationRow[];
  summary: { capacity: number; confirmedPeople: number; checkedInParties: number };
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Input
        type="date"
        className="h-11 w-fit"
        value={props.date}
        onChange={(e) => {
          setNotice(null);
          router.push(`/admin?date=${e.target.value}`);
        }}
      />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold">{props.summary.confirmedPeople}</p>
          <p className="text-xs text-muted-foreground">personas / {props.summary.capacity}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold">{props.summary.checkedInParties}</p>
          <p className="text-xs text-muted-foreground">grupos ingresados</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-2xl font-bold">{props.rows.length}</p>
          <p className="text-xs text-muted-foreground">reservas</p>
        </div>
      </div>
      {notice && <p role="alert" className="rounded-md bg-muted p-3 text-sm">{notice}</p>}
      <ReservationsTable
        rows={props.rows}
        onCheckIn={async (id) => {
          setNotice(null);
          const res = await adminCheckIn(id);
          setNotice(res.ok ? 'Entrada registrada.' : res.message ?? null);
          router.refresh();
        }}
        onResend={async (id) => {
          setNotice(null);
          const res = await adminResendVoucher(id);
          setNotice(res.ok ? 'Correo reenviado.' : res.message ?? null);
        }}
      />
    </div>
  );
}
