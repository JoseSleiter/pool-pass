'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ExceptionDialog } from './exception-dialog';
import { adminUpdateSettings, adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import { totalUsd } from '@/lib/money';
import type { SettingsRow, OverrideRow } from '@/lib/db/reservations';

type SaveState = 'idle' | 'saving' | 'saved';

export function SettingsForm(props: { settings: SettingsRow; overrides: OverrideRow[] }) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(props.settings.daily_capacity));
  const [adult, setAdult] = useState(String(props.settings.adult_price_usd));
  const [child, setChild] = useState(String(props.settings.child_price_usd));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<OverrideRow | null>(null);
  const [deleting, setDeleting] = useState<OverrideRow | null>(null);

  const preview = totalUsd(2, 1, { adult: Number(adult) || 0, child: Number(child) || 0 });
  const dirty =
    capacity !== String(props.settings.daily_capacity) ||
    adult !== String(props.settings.adult_price_usd) ||
    child !== String(props.settings.child_price_usd);

  async function save() {
    setError(null);
    if (capacity.trim() === '' || adult.trim() === '' || child.trim() === '') {
      setError('Todos los campos son requeridos.');
      return;
    }
    setSaveState('saving');
    const res = await adminUpdateSettings({
      daily_capacity: Number(capacity),
      adult_price_usd: Math.round(Number(adult) * 100) / 100,
      child_price_usd: Math.round(Number(child) * 100) / 100,
    });
    if (res.ok) { setSaveState('saved'); router.refresh(); }
    else { setSaveState('idle'); setError(res.message ?? 'No se pudo guardar.'); }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Administra la capacidad, los precios y las excepciones del club.</p>
      </div>

      {/* Parámetros generales */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-extrabold">Parámetros generales</h2>
        <p className="mb-3 text-sm text-muted-foreground">Estos valores se aplican a las reservas nuevas y pueden cambiarse en cualquier momento.</p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="capacity">Capacidad diaria</Label>
            <Input id="capacity" type="number" className="h-11" value={capacity}
              onChange={(e) => { setCapacity(e.target.value); setSaveState('idle'); }} />
            <p className="mt-1 text-xs text-muted-foreground">Límite máximo de personas que pueden ingresar en un día normal.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="adult">Precio adulto (USD)</Label>
              <Input id="adult" type="number" step="0.01" className="h-11" value={adult}
                onChange={(e) => { setAdult(e.target.value); setSaveState('idle'); }} />
            </div>
            <div className="flex-1">
              <Label htmlFor="child">Precio niño (USD)</Label>
              <Input id="child" type="number" step="0.01" className="h-11" value={child}
                onChange={(e) => { setChild(e.target.value); setSaveState('idle'); }} />
            </div>
          </div>
          <p className="rounded-lg bg-sky-50 p-2 text-sm text-slate-600">
            Una reserva de 2 adultos y 1 niño tendrá un valor estimado de <b>${preview.toFixed(2)} USD</b>.
          </p>
          <Button onClick={save} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Configuración guardada' : 'Guardar configuración'}
          </Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {saveState === 'saved' && !dirty && <p className="text-sm font-semibold text-green-700">Todos los cambios están guardados.</p>}
          {dirty && <p className="text-sm text-amber-700">Tienes cambios sin guardar.</p>}
        </div>
      </div>

      {/* Excepciones */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-extrabold">Excepciones de capacidad</h2>
            <p className="text-sm text-muted-foreground">Usa una excepción cuando un día tenga una capacidad diferente o el club permanezca cerrado.</p>
          </div>
          <Button size="sm" onClick={() => setShowNew(true)}>+ Nueva excepción</Button>
        </div>

        <div className="mt-3 space-y-2">
          {props.overrides.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
              No tienes excepciones configuradas. Agrega una fecha especial cuando la capacidad cambie.
            </p>
          )}
          {props.overrides.map((o) => (
            <div key={o.date} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <div>
                <p className="font-semibold">{o.date}</p>
                <p className="text-muted-foreground">
                  {o.capacity === 0 ? 'Club cerrado' : `Capacidad limitada a ${o.capacity} ${o.capacity === 1 ? 'persona' : 'personas'}`}
                  {o.reason ? ` · ${o.reason}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleting(o)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nueva */}
      {showNew && (
        <ExceptionDialog
          open={showNew}
          onOpenChange={setShowNew}
          onSave={async (date, cap, reason) => {
            const res = await adminUpsertOverride(date, cap, reason);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      )}
      {/* Modal editar */}
      {editing && (
        <ExceptionDialog
          open={editing !== null}
          initial={editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSave={async (date, cap, reason) => {
            const res = await adminUpsertOverride(date, cap, reason);
            if (res.ok) { setEditing(null); router.refresh(); }
            return res;
          }}
        />
      )}
      {/* Confirmar borrado */}
      {deleting && (
        <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
          <DialogPopup>
            <DialogTitle>¿Eliminar esta excepción?</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción cambiará la capacidad disponible para ese día.</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose render={<Button variant="outline">Cancelar</Button>} />
              <Button variant="destructive" onClick={async () => {
                await adminDeleteOverride(deleting.date);
                setDeleting(null);
                router.refresh();
              }}>Eliminar</Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </main>
  );
}
