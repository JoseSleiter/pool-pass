'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlideOver } from '@/components/admin/slide-over';
import { ADMIN_ACTION, ADMIN_INPUT, DIALOG_ACTION } from '@/components/admin/ui-constants';
import { cn } from '@/lib/utils';
import { reservationsHref, type GuestType, type ReservationsState } from '../_lib/search-params';

const GUEST_OPTIONS: { value: GuestType | ''; label: string; hint: string }[] = [
  { value: '', label: 'Todos', hint: 'Cualquier tamaño de grupo' },
  { value: 'individual', label: 'Individual', hint: '1 persona' },
  { value: 'family', label: 'Familia', hint: '2 o más personas' },
];

/** Advanced filters (md2 §2): visit date range and guest type, applied to the URL. */
export function FiltersDrawer(props: { state: ReservationsState }) {
  const { state } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(state.from);
  const [to, setTo] = useState(state.to);
  const [guest, setGuest] = useState<GuestType | ''>(state.guest);
  const [error, setError] = useState<string | null>(null);
  const count = [state.from, state.to, state.guest].filter(Boolean).length;

  function openDrawer() {
    setFrom(state.from);
    setTo(state.to);
    setGuest(state.guest);
    setError(null);
    setOpen(true);
  }

  function reset() {
    setFrom('');
    setTo('');
    setGuest('');
    setError(null);
  }

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (from && to && from > to) {
      setError('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    router.push(reservationsHref(state, { from, to, guest }), { scroll: false });
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" className={cn(ADMIN_ACTION, 'gap-2 bg-white')} onClick={openDrawer}>
        <SlidersHorizontal aria-hidden className="size-4" />
        Filtros
        {count > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </Button>

      <SlideOver open={open} onOpenChange={setOpen} title="Filtros avanzados">
        <form onSubmit={apply} noValidate className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-navy">Fecha de visita</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from">Desde</Label>
                <Input id="filter-from" type="date" className={ADMIN_INPUT} value={from}
                  max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-to">Hasta</Label>
                <Input id="filter-to" type="date" className={ADMIN_INPUT} value={to}
                  min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-navy">Tipo de grupo</legend>
            {GUEST_OPTIONS.map((o) => (
              <label
                key={o.value || 'all'}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 has-[:checked]:border-teal has-[:checked]:bg-mint"
              >
                <input type="radio" name="guest" value={o.value} checked={guest === o.value}
                  onChange={() => setGuest(o.value)} className="size-4 accent-teal" />
                <span className="font-medium">{o.label}</span>
                <span className="text-sm text-muted-foreground">{o.hint}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className={DIALOG_ACTION} onClick={reset}>Restablecer</Button>
            <Button type="submit" className={DIALOG_ACTION}>Aplicar filtros</Button>
          </div>
        </form>
      </SlideOver>
    </>
  );
}
