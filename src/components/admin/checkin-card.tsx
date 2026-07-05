'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReservationRow } from '@/lib/db/reservations';

type BannerKind = 'valid' | 'wrong-date' | 'already-in' | 'invalid';

function classify(r: ReservationRow, today: string): BannerKind {
  if (r.status === 'checked_in') return 'already-in';
  if (r.status !== 'confirmed') return 'invalid';
  if (r.date !== today) return 'wrong-date';
  return 'valid';
}

const BANNER: Record<BannerKind, { text: (r: ReservationRow) => string; cls: string }> = {
  valid: { text: () => '✅ Reserva válida para hoy', cls: 'bg-green-100 text-green-900' },
  'wrong-date': {
    text: (r) => `⚠️ Fecha distinta: la reserva es para ${r.date}`,
    cls: 'bg-yellow-100 text-yellow-900',
  },
  'already-in': {
    text: (r) => `⛔ Ya registró entrada (${r.checked_in_at?.slice(11, 16) ?? ''})`,
    cls: 'bg-red-100 text-red-900',
  },
  invalid: { text: (r) => `⛔ Reserva no válida (estado: ${r.status})`, cls: 'bg-red-100 text-red-900' },
};

export function CheckinCard(props: {
  reservation: ReservationRow;
  today: string;
  onCheckIn: (id: string) => Promise<{ ok: boolean; message?: string }> | void;
}) {
  const r = props.reservation;
  const kind = classify(r, props.today);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div data-testid="banner" className={`rounded-lg p-4 text-center font-semibold ${BANNER[kind].cls}`}>
        {done ? '✅ Entrada registrada' : BANNER[kind].text(r)}
      </div>
      <Card>
        <CardContent className="space-y-1 pt-4">
          <p className="font-mono text-lg font-bold">{r.code}</p>
          <p>{r.first_name} {r.last_name} · {r.id_type}-{r.id_number}</p>
          <p>{r.adults} adultos, {r.children} niños</p>
          <p className="text-sm text-muted-foreground">
            Pagado: ${Number(r.total_usd).toFixed(2)} / Bs. {Number(r.total_ves ?? 0).toFixed(2)}
          </p>
        </CardContent>
      </Card>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {kind === 'valid' && !done && (
        <Button
          className="h-14 w-full text-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await props.onCheckIn(r.id);
            setBusy(false);
            if (res && !res.ok) {
              setError(res.message ?? 'No se pudo registrar la entrada.');
              return;
            }
            setDone(true);
          }}
        >
          {busy ? 'Registrando…' : 'Registrar entrada'}
        </Button>
      )}
    </div>
  );
}
