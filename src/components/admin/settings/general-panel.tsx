'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DIALOG_ACTION } from '../ui-constants';
import { adminUpdateSettings } from '@/app/admin/actions';
import { totalUsd, usdToVes } from '@/lib/money';
import type { SettingsRow } from '@/lib/db/reservations';
import { NumberStepper, parseStepperValue, type StepperBounds } from './number-stepper';
import { projectRevenue } from './projection';
import { BcvCard } from './bcv-card';

// Same limits as settingsSchema in src/app/admin/actions.ts.
export const CAPACITY_BOUNDS: StepperBounds = { min: 0, max: 10000, step: 1, decimals: 0 };
export const PRICE_BOUNDS: StepperBounds = { min: 0, max: 1000, step: 0.5, decimals: 2 };

type SaveState = 'idle' | 'saving' | 'saved';

const usd = (n: number) => `$${n.toFixed(2)}`;
const ves = (n: number) => `Bs. ${n.toFixed(2)}`;

export function GeneralPanel(props: { settings: SettingsRow; now: number }) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(props.settings.daily_capacity));
  const [adult, setAdult] = useState(String(props.settings.adult_price_usd));
  const [child, setChild] = useState(String(props.settings.child_price_usd));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const cap = parseStepperValue(capacity);
  const adultN = parseStepperValue(adult);
  const childN = parseStepperValue(child);
  const projection = cap !== null && adultN !== null && childN !== null
    ? projectRevenue(cap, adultN, childN)
    : null;
  const preview = totalUsd(2, 1, { adult: adultN ?? 0, child: childN ?? 0 });
  const rate = props.settings.last_bcv_rate != null ? Number(props.settings.last_bcv_rate) : null;

  const dirty =
    capacity !== String(props.settings.daily_capacity) ||
    adult !== String(props.settings.adult_price_usd) ||
    child !== String(props.settings.child_price_usd);

  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setSaveState('idle');
      setError(null);
    };
  }

  function discard() {
    setCapacity(String(props.settings.daily_capacity));
    setAdult(String(props.settings.adult_price_usd));
    setChild(String(props.settings.child_price_usd));
    setSaveState('idle');
    setError(null);
  }

  async function save() {
    setError(null);
    if (cap === null || adultN === null || childN === null) {
      setError('Todos los campos son requeridos.');
      return;
    }
    setSaveState('saving');
    const res = await adminUpdateSettings({
      daily_capacity: cap,
      adult_price_usd: Math.round(adultN * 100) / 100,
      child_price_usd: Math.round(childN * 100) / 100,
    });
    if (res.ok) { setSaveState('saved'); router.refresh(); }
    else { setSaveState('idle'); setError(res.message ?? 'No se pudo guardar.'); }
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="general-title" className="rounded-2xl border bg-white p-4">
        <h2 id="general-title" className="font-extrabold">Parámetros generales</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Estos valores se aplican a las reservas nuevas y pueden cambiarse en cualquier momento.
        </p>

        <div className="space-y-4">
          <NumberStepper
            id="capacity" label="Capacidad diaria" value={capacity} onChange={edit(setCapacity)}
            bounds={CAPACITY_BOUNDS} unit="personas"
            hint="Límite máximo de personas que pueden ingresar en un día normal."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberStepper id="adult" label="Precio adulto (USD)" value={adult} onChange={edit(setAdult)} bounds={PRICE_BOUNDS} />
            <NumberStepper id="child" label="Precio niño (USD)" value={child} onChange={edit(setChild)} bounds={PRICE_BOUNDS} />
          </div>

          <section aria-labelledby="projection-title" className="rounded-xl bg-sky-50 p-3 text-sm text-slate-700">
            <h3 id="projection-title" className="font-semibold">Proyección de ingresos con el día lleno</h3>
            {projection ? (
              <>
                <p className="mt-1">
                  Con {projection.capacity} {projection.capacity === 1 ? 'persona' : 'personas'} (100 % de la capacidad),
                  un día lleno deja entre <b>{usd(projection.min)}</b> y <b>{usd(projection.max)}</b> USD.
                </p>
                <ul className="mt-2 space-y-1">
                  <li>Si todos son adultos: <b className="tabular-nums">{usd(projection.allAdults)}</b></li>
                  <li>Si todos son niños: <b className="tabular-nums">{usd(projection.allChildren)}</b></li>
                </ul>
                {rate !== null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ≈ {ves(usdToVes(projection.min, rate))} – {ves(usdToVes(projection.max, rate))} a la tasa BCV guardada ({ves(rate)} por USD).
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  El ingreso real depende de cuántos adultos y niños reserven, y no incluye las excepciones de capacidad.
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">Completa capacidad y precios para ver la proyección.</p>
            )}
          </section>

          <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
            Una reserva de 2 adultos y 1 niño tendrá un valor estimado de <b>${preview.toFixed(2)} USD</b>.
          </p>
        </div>

        {/* Footer de acciones — descartar a la izquierda, guardar a la derecha */}
        <div className="mt-4 border-t pt-4">
          {/* 'saved' wins over 'dirty': until router.refresh() brings the new props, the
              fields still differ from props.settings. Any edit resets saveState to 'idle'. */}
          <p role="status" className="mb-3 text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : saveState === 'saved' ? (
              <span className="font-semibold text-green-700">✓ Todos los cambios están guardados.</span>
            ) : dirty ? (
              <span className="text-amber-700">Tienes cambios sin guardar.</span>
            ) : null}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {dirty && (
                <Button variant="ghost" className={DIALOG_ACTION} onClick={discard} disabled={saveState === 'saving'}>
                  Descartar
                </Button>
              )}
            </div>
            <Button className={DIALOG_ACTION} onClick={save} disabled={!dirty || saveState === 'saving'}>
              {saveState === 'saving' ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </div>
      </section>

      <BcvCard rate={rate} at={props.settings.last_bcv_rate_at} now={props.now} />
    </div>
  );
}
