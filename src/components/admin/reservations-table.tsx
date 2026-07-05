'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReservationRow } from '@/lib/db/reservations';

const STATUS_BADGE: Record<ReservationRow['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_payment: { label: 'Pendiente', variant: 'outline' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  checked_in: { label: 'Ingresó', variant: 'secondary' },
  failed: { label: 'Fallida', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'destructive' },
};

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
          <div key={r.id} data-testid="res-row" className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{r.code}</span>
              <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
            </div>
            <p className="text-sm">
              {r.first_name} {r.last_name} · {r.id_type}-{r.id_number}
            </p>
            <p className="text-sm text-muted-foreground">
              {r.adults} adultos, {r.children} niños · ${Number(r.total_usd).toFixed(2)}
            </p>
            <div className="mt-2 flex gap-2">
              {r.status === 'confirmed' && (
                <Button size="sm" onClick={() => props.onCheckIn(r.id)}>Check-in</Button>
              )}
              {['confirmed', 'checked_in'].includes(r.status) && (
                <Button size="sm" variant="outline" onClick={() => props.onResend(r.id)}>
                  Reenviar correo
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
