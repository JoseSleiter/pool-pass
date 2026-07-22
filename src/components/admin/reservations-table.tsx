'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ReservationCard } from './reservation-card';
import { ReservationDetailDialog } from './reservation-detail-dialog';
import { CheckinDialog } from './checkin-dialog';
import type { ReservationRow } from '@/lib/db/reservations';

type ChipKey = 'all' | 'confirmed' | 'checked_in' | 'pending_payment' | 'canceled';

const CHIPS: { key: ChipKey; label: string; match: (r: ReservationRow) => boolean }[] = [
  { key: 'all', label: 'Todas', match: () => true },
  { key: 'confirmed', label: 'Confirmadas', match: (r) => r.status === 'confirmed' },
  { key: 'checked_in', label: 'Ingresaron', match: (r) => r.status === 'checked_in' },
  { key: 'pending_payment', label: 'Pendientes', match: (r) => r.status === 'pending_payment' },
  { key: 'canceled', label: 'Canceladas', match: (r) => r.status === 'failed' || r.status === 'expired' },
];

export function ReservationsTable(props: {
  rows: ReservationRow[];
  today: string;
  onCheckIn: (id: string) => Promise<{ ok: boolean; message?: string }> | void;
  onResend: (id: string) => void;
  initialChip?: ChipKey;
  chip?: ChipKey;
  onChipChange?: (chip: ChipKey) => void;
}) {
  const [q, setQ] = useState('');
  const [internalChip, setInternalChip] = useState<ChipKey>(props.initialChip ?? 'all');
  const chip = props.chip ?? internalChip;
  const setChip = (c: ChipKey) => {
    if (props.onChipChange) props.onChipChange(c);
    else setInternalChip(c);
  };
  const [detailId, setDetailId] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const byChip = CHIPS.find((c) => c.key === chip)!.match;
  const rows = props.rows.filter((r) =>
    byChip(r) &&
    (needle === '' ||
      r.code.toLowerCase().includes(needle) ||
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) ||
      r.id_number.includes(needle))
  );

  const detail = props.rows.find((r) => r.id === detailId) ?? null;
  const checkin = props.rows.find((r) => r.id === checkinId) ?? null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input placeholder="Buscar por nombre, código o cédula…" className="h-11 pr-9"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {q !== '' && (
          <button type="button" aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
            onClick={() => setQ('')}>×</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const count = props.rows.filter(c.match).length;
          const active = chip === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setChip(c.key)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
                active ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'
              }`}>
              {c.label} · {count}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{rows.length} reservas encontradas</p>

      <div className="space-y-2">
        {rows.map((r) => (
          <ReservationCard
            key={r.id}
            reservation={r}
            onDetail={setDetailId}
            onResend={props.onResend}
            onCheckin={setCheckinId}
          />
        ))}
        {rows.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No hay reservas para este día. Prueba con otra fecha o revisa las reservas futuras.
          </p>
        )}
      </div>

      {detail && (
        <ReservationDetailDialog
          reservation={detail}
          open={detailId !== null}
          onOpenChange={(o) => { if (!o) setDetailId(null); }}
          onStartCheckin={() => { setDetailId(null); setCheckinId(detail.id); }}
        />
      )}
      {checkin && (
        <CheckinDialog
          reservation={checkin}
          today={props.today}
          open={checkinId !== null}
          onOpenChange={(o) => { if (!o) setCheckinId(null); }}
          onApprove={async (id) => {
            const res = await props.onCheckIn(id);
            return res ?? { ok: true };
          }}
        />
      )}
    </div>
  );
}

export type { ChipKey };
