'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarX2,
  CircleCheckBig,
  CircleX,
  DoorOpen,
  LoaderCircle,
  OctagonX,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReservationRow } from '@/lib/db/reservations';
import {
  INVALID_REASON_TEXT,
  caracasTime12,
  classifyCheckin,
  reservationDateEs,
  type CheckinState,
} from './checkin-state';

type View = CheckinState['kind'] | 'success';

interface Tone {
  /** Full-bleed background + text color of the whole gate view. */
  surface: string;
  /** Inner panels (code chip, guest data); they never lower text contrast. */
  panel: string;
  icon: LucideIcon;
}

// WCAG 2.x contrast, Tailwind v4 OKLCH palette converted to sRGB
// (details in docs/superpowers/plans/2026-10-04-pr08-admin-checkin-gate.md):
//   valid      white on green-800 #016630      7.09:1 · panel black/25 10.08:1
//   success    white on green-900 #0d542b      9.07:1 · panel black/25 12.05:1
//   wrong-date navy-deep on amber-400 #ffb900 10.07:1 · panel white/40 12.34:1
//   already-in white on red-800 #9f0712        8.37:1 · panel black/25 11.58:1
//   invalid    white on red-900 #82181a       10.06:1 · panel black/25 13.07:1
//   button     green-900 on white              9.07:1
const TONE: Record<View, Tone> = {
  valid: { surface: 'bg-green-800 text-white', panel: 'bg-black/25', icon: CircleCheckBig },
  success: { surface: 'bg-green-900 text-white', panel: 'bg-black/25', icon: DoorOpen },
  'wrong-date': { surface: 'bg-amber-400 text-navy-deep', panel: 'bg-white/40', icon: CalendarX2 },
  'already-in': { surface: 'bg-red-800 text-white', panel: 'bg-black/25', icon: OctagonX },
  invalid: { surface: 'bg-red-900 text-white', panel: 'bg-black/25', icon: CircleX },
};

// Vibration patterns (ms): distinct rhythms so the operator can tell states apart without looking.
const HAPTIC: Record<View, number | number[]> = {
  valid: 80,
  success: [60, 40, 60],
  'wrong-date': [150, 100, 150],
  'already-in': [400, 120, 400],
  invalid: [400, 120, 400],
};
const HAPTIC_ERROR = [200, 80, 200];

/**
 * navigator.vibrate is missing on iOS Safari and desktop, and browsers may
 * ignore or reject it without prior user activation (e.g. on page load right
 * after the camera opened the URL).
 */
function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptics are a nicety; never break the gate over them.
  }
}

function copy(state: CheckinState, enteredAt: string | null): { title: string; detail: string | null } {
  if (enteredAt) {
    return { title: 'Entrada registrada', detail: `Hora de entrada: ${caracasTime12(enteredAt)}` };
  }
  switch (state.kind) {
    case 'valid':
      return { title: 'Reserva válida para hoy', detail: null };
    case 'wrong-date':
      return {
        title: 'Reserva para otra fecha',
        detail: `Fecha de la reserva: ${reservationDateEs(state.date)}`,
      };
    case 'already-in':
      return {
        title: state.checkedInAt
          ? `Entrada ya registrada a las ${caracasTime12(state.checkedInAt)}`
          : 'Entrada ya registrada',
        detail: null,
      };
    case 'invalid':
      return { title: 'Reserva no encontrada o no válida', detail: INVALID_REASON_TEXT[state.reason] };
  }
}

/**
 * Full-screen gate view opened by the operator's phone camera from the voucher
 * QR. Designed for outdoor sunlight: full-bleed state color, huge type, icon +
 * text per state (never color alone).
 */
export function CheckinCard({
  reservation,
  today,
  onCheckIn,
  now = () => new Date(),
}: {
  reservation: ReservationRow | null;
  today: string;
  onCheckIn: (id: string) => Promise<{ ok: boolean; message?: string }>;
  /** Clock for the success timestamp; injectable for tests. */
  now?: () => Date;
}) {
  const state = classifyCheckin(reservation, today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enteredAt, setEnteredAt] = useState<string | null>(null);

  const view: View = enteredAt ? 'success' : state.kind;
  const tone = TONE[view];
  const Icon = tone.icon;
  const { title, detail } = copy(state, enteredAt);

  useEffect(() => {
    buzz(HAPTIC[view]);
  }, [view]);

  async function register() {
    if (!reservation || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onCheckIn(reservation.id);
      if (!res.ok) {
        buzz(HAPTIC_ERROR);
        setError(res.message ?? 'No se pudo registrar la entrada.');
        return;
      }
      setEnteredAt(now().toISOString());
    } catch {
      buzz(HAPTIC_ERROR);
      setError('No se pudo registrar la entrada. Revisa la conexión e intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="gate"
      data-state={view}
      aria-labelledby="gate-title"
      className={cn('flex min-h-dvh flex-1 flex-col', tone.surface)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-lg font-semibold underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-current"
        >
          <ArrowLeft aria-hidden className="size-6" />
          Volver al panel
        </Link>
        <p
          data-testid="gate-code"
          className={cn('rounded-lg px-3 py-2 font-mono text-2xl font-bold tracking-wider', tone.panel)}
        >
          <span className="sr-only">Código de reserva: </span>
          {reservation?.code ?? 'Sin código'}
        </p>
      </header>

      <div
        key={view}
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300"
      >
        <Icon data-testid="gate-icon" aria-hidden className="size-24 sm:size-32" strokeWidth={2.5} />
        <h1
          id="gate-title"
          className="font-heading text-4xl leading-tight font-bold text-balance sm:text-6xl"
        >
          {title}
        </h1>
        {detail && <p className="text-2xl font-semibold text-balance sm:text-3xl">{detail}</p>}
      </div>

      {reservation && (
        <dl
          data-testid="gate-details"
          className={cn('mx-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl p-5', tone.panel)}
        >
          <div className="col-span-2">
            <dt className="text-sm font-semibold tracking-wide uppercase">Titular</dt>
            <dd className="text-3xl font-bold break-words">
              {`${reservation.first_name} ${reservation.last_name}`}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm font-semibold tracking-wide uppercase">Documento</dt>
            <dd className="font-mono text-2xl font-bold">
              {`${reservation.id_type}-${reservation.id_number}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold tracking-wide uppercase">Adultos</dt>
            <dd data-testid="gate-adults" className="text-5xl font-bold tabular-nums">
              {reservation.adults}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold tracking-wide uppercase">Niños</dt>
            <dd data-testid="gate-children" className="text-5xl font-bold tabular-nums">
              {reservation.children}
            </dd>
          </div>
        </dl>
      )}

      <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="rounded-xl bg-white p-4 text-lg font-semibold text-red-900">
            {error}
          </p>
        )}
        {view === 'valid' && (
          <Button
            type="button"
            onClick={register}
            disabled={busy}
            aria-busy={busy}
            className="h-[60px] w-full gap-3 rounded-2xl bg-white text-xl font-bold text-green-900 hover:bg-white/90 disabled:opacity-100"
          >
            {busy ? (
              <>
                <LoaderCircle aria-hidden className="size-6 motion-safe:animate-spin" />
                Registrando…
              </>
            ) : (
              'Registrar entrada'
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
