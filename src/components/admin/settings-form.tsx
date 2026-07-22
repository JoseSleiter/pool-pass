'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ExceptionDialog } from './exception-dialog';
import { ADMIN_ACTION, ADMIN_ICON_ACTION, ADMIN_INPUT, DIALOG_FOOTER, DIALOG_ACTION } from './ui-constants';
import { adminUpdateSettings, adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import { totalUsd } from '@/lib/money';
import { shortDateEs } from '@/lib/dates';
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const preview = totalUsd(2, 1, { adult: Number(adult) || 0, child: Number(child) || 0 });
  const dirty =
    capacity !== String(props.settings.daily_capacity) ||
    adult !== String(props.settings.adult_price_usd) ||
    child !== String(props.settings.child_price_usd);

  function edit(setter: (v: string) => void, value: string) {
    setter(value);
    setSaveState('idle');
    setError(null);
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
            <Input id="capacity" type="number" min={0} className={ADMIN_INPUT} value={capacity}
              onChange={(e) => edit(setCapacity, e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Límite máximo de personas que pueden ingresar en un día normal.</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="adult">Precio adulto (USD)</Label>
              <Input id="adult" type="number" min={0} step="0.01" className={ADMIN_INPUT} value={adult}
                onChange={(e) => edit(setAdult, e.target.value)} />
            </div>
            <div className="flex-1">
              <Label htmlFor="child">Precio niño (USD)</Label>
              <Input id="child" type="number" min={0} step="0.01" className={ADMIN_INPUT} value={child}
                onChange={(e) => edit(setChild, e.target.value)} />
            </div>
          </div>
          <p className="rounded-lg bg-sky-50 p-2 text-sm text-slate-600">
            Una reserva de 2 adultos y 1 niño tendrá un valor estimado de <b>${preview.toFixed(2)} USD</b>.
          </p>
        </div>

        {/* Footer de acciones — descartar a la izquierda, guardar a la derecha */}
        <div className="mt-4 border-t pt-4">
          <p role="status" className="mb-3 text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : dirty ? (
              <span className="text-amber-700">Tienes cambios sin guardar.</span>
            ) : saveState === 'saved' ? (
              <span className="font-semibold text-green-700">✓ Todos los cambios están guardados.</span>
            ) : null}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {dirty && (
                <Button variant="ghost" className={DIALOG_ACTION} onClick={discard} disabled={saveState === 'saving'}>Descartar</Button>
              )}
            </div>
            <Button className={DIALOG_ACTION} onClick={save} disabled={!dirty || saveState === 'saving'}>
              {saveState === 'saving' ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          </div>
        </div>
      </div>

      {/* Excepciones */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-extrabold">Excepciones de capacidad</h2>
        <p className="text-sm text-muted-foreground">Usa una excepción cuando un día tenga una capacidad diferente o el club permanezca cerrado.</p>

        <div className="mt-3 space-y-2">
          {props.overrides.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-muted-foreground">
              No tienes excepciones configuradas.<br />Agrega una fecha especial cuando la capacidad cambie.
            </p>
          )}
          {props.overrides.map((o) => {
            const closed = o.capacity === 0;
            return (
              <div key={o.date} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize">{shortDateEs(o.date)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      closed ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-800'
                    }`}>
                      {closed ? 'Cerrado' : 'Especial'}
                    </span>
                  </div>
                  <p className="truncate text-muted-foreground">
                    {closed ? 'Club cerrado' : `Capacidad limitada a ${o.capacity} ${o.capacity === 1 ? 'persona' : 'personas'}`}
                    {o.reason ? ` · ${o.reason}` : ''}
                  </p>
                </div>
                {/* Acciones de la fila — alineadas a la derecha */}
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" className={ADMIN_ICON_ACTION} variant="ghost" aria-label="Editar excepción" title="Editar"
                    onClick={() => setEditing(o)}>
                    <Pencil />
                  </Button>
                  <Button size="icon" className={ADMIN_ICON_ACTION} variant="destructive" aria-label="Eliminar excepción" title="Eliminar"
                    onClick={() => { setDeleteError(null); setDeleting(o); }}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer de acciones — abajo a la derecha */}
        <div className="mt-4 flex justify-end border-t pt-4">
          <Button className={ADMIN_ACTION} onClick={() => setShowNew(true)}>
            <Plus /> Nueva excepción
          </Button>
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
        <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
          <DialogPopup>
            <DialogTitle>¿Eliminar esta excepción?</DialogTitle>
            <p className="mt-2 text-sm text-muted-foreground">Esta acción cambiará la capacidad disponible para ese día.</p>
            {deleteError && <p role="alert" className="mt-2 text-sm text-destructive">{deleteError}</p>}
            <div className={DIALOG_FOOTER}>
              <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
              <Button variant="destructive" className={DIALOG_ACTION} onClick={async () => {
                const res = await adminDeleteOverride(deleting.date);
                if (res.ok) { setDeleting(null); router.refresh(); }
                else setDeleteError(res.message ?? 'No se pudo eliminar.');
              }}>Eliminar</Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </main>
  );
}
