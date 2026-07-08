'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { partyShort } from '@/lib/party';
import { caracasTime } from '@/lib/dates';
import type { ReservationRow } from '@/lib/db/reservations';

const CHIP: Record<string, string> = {
  confirmed: 'bg-sky-100 text-sky-800',
  checked_in: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

function statusLabel(r: ReservationRow): string {
  switch (r.status) {
    case 'checked_in': return `Ingresó ${r.checked_in_at ? caracasTime(r.checked_in_at) : ''}`.trim();
    case 'pending_payment': return 'Pago en verificación';
    case 'confirmed': return 'Confirmada';
    case 'failed': return 'Fallida';
    case 'expired': return 'Expirada';
  }
}

export function ReservationsTable(props: {
  rows: ReservationRow[];
  onCheckIn: (id: string) => void;
  onResend: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = props.rows.filter((r) =>
    needle === '' ||
    r.code.toLowerCase().includes(needle) ||
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) ||
    r.id_number.includes(needle)
  );

  return (
    <div className="space-y-3">
      <Input placeholder="Buscar por nombre, código o cédula…" className="h-11"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} data-testid="res-row" className="rounded-2xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{r.code}</span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CHIP[r.status]}`}>
                {statusLabel(r)}
              </span>
            </div>
            <p className="text-sm">
              {r.first_name} {r.last_name} · {r.id_type}-{r.id_number}
            </p>
            <p className="text-sm text-muted-foreground">
              {partyShort(r.adults, r.children)} · ${Number(r.total_usd).toFixed(2)}
            </p>
            <div className="mt-2 flex gap-2">
              {r.status === 'confirmed' && (
                <Button size="sm" className="rounded-full" onClick={() => props.onCheckIn(r.id)}>Check-in</Button>
              )}
              {['confirmed', 'checked_in'].includes(r.status) && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => props.onResend(r.id)}>
                  ✉️ Reenviar
                </Button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">Sin reservas.</p>
        )}
      </div>
    </div>
  );
}
