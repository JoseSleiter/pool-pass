'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { shortDateEs } from '@/lib/dates';
import { adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import type { OverrideRow } from '@/lib/db/reservations';
import { ExceptionDialog } from '../exception-dialog';
import { ADMIN_ACTION, ADMIN_ICON_ACTION, DIALOG_ACTION, DIALOG_FOOTER } from '../ui-constants';
import { ExceptionsCalendar } from './exceptions-calendar';
import { REASON_CHIP_CLASS, reasonKind } from './reason-presets';

type DialogState = { mode: 'new'; date?: string } | { mode: 'edit'; row: OverrideRow } | null;

function ReasonChip(props: { reason: string | null }) {
  const kind = reasonKind(props.reason);
  if (!kind) return null;
  return (
    <span className={cn('max-w-[14rem] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold', REASON_CHIP_CLASS[kind])}>
      {props.reason}
    </span>
  );
}

export function ExceptionsPanel(props: { overrides: OverrideRow[]; today: string }) {
  const router = useRouter();
  const [month, setMonth] = useState(props.today.slice(0, 7));
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<OverrideRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(props.overrides.map((o) => [o.date, o])), [props.overrides]);

  function openDay(date: string) {
    const row = byDate.get(date);
    setDialog(row ? { mode: 'edit', row } : { mode: 'new', date });
  }

  async function save(date: string, capacity: number, reason?: string) {
    const res = await adminUpsertOverride(date, capacity, reason);
    if (res.ok) { setDialog(null); router.refresh(); }
    return res;
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="calendar-title" className="rounded-2xl border bg-white p-4">
        <h2 id="calendar-title" className="font-extrabold">Calendario de excepciones</h2>
        <p className="mb-3 text-sm text-muted-foreground">Toca un día para crear o editar su excepción.</p>
        <ExceptionsCalendar month={month} today={props.today} overrides={byDate}
          onMonthChange={setMonth} onSelectDay={openDay} />
      </section>

      <section aria-labelledby="exceptions-title" className="rounded-2xl border bg-white p-4">
        <h2 id="exceptions-title" className="font-extrabold">Excepciones de capacidad</h2>
        <p className="text-sm text-muted-foreground">
          Usa una excepción cuando un día tenga una capacidad diferente o el complejo permanezca cerrado.
        </p>

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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block font-semibold first-letter:uppercase">{shortDateEs(o.date)}</span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      closed ? 'bg-coral/20 text-navy' : 'bg-teal/20 text-navy',
                    )}>
                      {closed ? 'Cerrado' : 'Especial'}
                    </span>
                    <ReasonChip reason={o.reason} />
                  </div>
                  <p className="truncate text-muted-foreground">
                    {closed ? 'Complejo cerrado' : `Capacidad limitada a ${o.capacity} ${o.capacity === 1 ? 'persona' : 'personas'}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" className={ADMIN_ICON_ACTION} variant="ghost" aria-label="Editar excepción" title="Editar"
                    onClick={() => setDialog({ mode: 'edit', row: o })}>
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

        <div className="mt-4 flex justify-end border-t pt-4">
          <Button className={ADMIN_ACTION} onClick={() => setDialog({ mode: 'new' })}>
            <Plus /> Nueva excepción
          </Button>
        </div>
      </section>

      {dialog && (
        <ExceptionDialog
          key={dialog.mode === 'edit' ? `edit-${dialog.row.date}` : `new-${dialog.date ?? ''}`}
          open
          onOpenChange={(o) => { if (!o) setDialog(null); }}
          initial={dialog.mode === 'edit' ? dialog.row : undefined}
          defaultDate={dialog.mode === 'new' ? dialog.date : undefined}
          onSave={save}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(o) => { if (!o) { setDeleting(null); setDeleteError(null); } }}>
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
    </div>
  );
}
