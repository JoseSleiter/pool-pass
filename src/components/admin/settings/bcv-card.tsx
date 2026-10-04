'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ADMIN_ACTION } from '../ui-constants';
import { adminRefreshBcvRate } from '@/app/admin/settings-actions';
import { rateAgeLabel, rateFreshness, rateStampEs } from './bcv-age';

/** `now` comes from the server render so SSR and hydration print the same age. */
export function BcvCard(props: { rate: number | null; at: string | null; now: number }) {
  const router = useRouter();
  const [rate, setRate] = useState(props.rate);
  const [at, setAt] = useState(props.at);
  const [now, setNow] = useState(props.now);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setStatus(null);
    const res = await adminRefreshBcvRate();
    setBusy(false);
    if (res.ok) {
      setRate(res.rate);
      setAt(res.at);
      setNow(Date.parse(res.at));
      setStatus({ kind: 'ok', text: `Tasa actualizada: Bs. ${res.rate.toFixed(2)} por USD.` });
      router.refresh();
    } else {
      setStatus({ kind: 'error', text: res.message });
    }
  }

  return (
    <section aria-labelledby="bcv-title" className="rounded-2xl border bg-white p-4">
      <h2 id="bcv-title" className="font-extrabold">Tasa BCV</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Se usa para cobrar en bolívares. Se renueva sola (como máximo cada hora) cuando la web la necesita; aquí puedes forzarla.
      </p>

      {rate === null ? (
        <p className="text-sm text-muted-foreground">Aún no hay una tasa guardada.</p>
      ) : (
        <div>
          <p className="text-2xl font-extrabold tabular-nums text-navy">
            Bs. {rate.toFixed(2)} <span className="text-sm font-semibold text-muted-foreground">por USD</span>
          </p>
          {at && (
            <p className="text-sm text-muted-foreground">
              Actualizada {rateAgeLabel(at, now)} ·{' '}
              <span className="inline-block first-letter:uppercase">{rateStampEs(at)}</span> (hora de Caracas)
            </p>
          )}
          {at && rateFreshness(at, now) === 'expired' && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Tiene más de 24 horas. Actualízala para evitar errores al cobrar en bolívares.
            </p>
          )}
        </div>
      )}

      <p role="status" className="mt-3 min-h-5 text-sm">
        {status && (
          <span className={status.kind === 'ok' ? 'font-semibold text-green-700' : 'text-destructive'}>{status.text}</span>
        )}
      </p>
      <div className="mt-2 flex justify-end">
        <Button variant="outline" className={ADMIN_ACTION} disabled={busy} onClick={refresh}>
          <RefreshCw aria-hidden className={cn(busy && 'motion-safe:animate-spin')} />
          {busy ? 'Actualizando…' : 'Actualizar tasa ahora'}
        </Button>
      </div>
    </section>
  );
}
