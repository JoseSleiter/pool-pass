'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { adminUpsertRole, type AdminAccessEntry } from '@/app/admin/actions';
import type { AdminRole } from '@/lib/db/admin-roles';
import { ROLE_LABEL } from '../profile-pill';
import { ADMIN_INPUT, DIALOG_ACTION, DIALOG_FOOTER } from '../ui-constants';

const ROLE_HELP: Record<AdminRole, string> = {
  owner: 'Acceso total: configuración, excepciones, accesos y auditoría.',
  operator: 'Puede ver reservas y registrar entradas, pero no cambiar la configuración ni los accesos, ni ver la auditoría.',
};

export function RolesPanel(props: { entries: AdminAccessEntry[]; currentEmail: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ email: string; role: AdminRole } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const me = props.currentEmail.toLowerCase();

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const res = await adminUpsertRole(pending);
    setBusy(false);
    if (res.ok) { setPending(null); router.refresh(); }
    else setError(res.message ?? 'No se pudo cambiar el rol.');
  }

  return (
    <section aria-labelledby="roles-title" className="rounded-2xl border bg-white p-4">
      <h2 id="roles-title" className="font-extrabold">Accesos</h2>
      <p className="text-sm text-muted-foreground">Personas que pueden entrar al panel y su rol.</p>

      <ul className="mt-3 space-y-2">
        {props.entries.map((e) => {
          const self = e.email === me;
          const helpId = `role-help-${e.email}`;
          return (
            <li key={e.email} className="flex flex-col gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  <span>{e.email}</span>
                  {self && <span className="font-normal text-muted-foreground"> (tú)</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    e.role === 'owner' ? 'bg-teal/20 text-navy' : 'bg-slate-100 text-slate-700',
                  )}>
                    {ROLE_LABEL[e.role]}
                  </span>
                  {!e.explicit && (
                    <span title="Sin rol asignado: por defecto es dueño."
                      className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
                      por defecto
                    </span>
                  )}
                </div>
                {self && (
                  <p id={helpId} className="mt-1 text-xs text-muted-foreground">
                    No puedes cambiar tu propio rol: si te quitas el rol de dueño perderías el acceso a esta página. Pide a otro dueño que lo haga.
                  </p>
                )}
              </div>
              <select
                aria-label={`Rol de ${e.email}`}
                aria-describedby={self ? helpId : undefined}
                className={cn(ADMIN_INPUT, 'w-full rounded-lg border border-input bg-background px-3 sm:w-40')}
                value={e.role}
                disabled={self}
                onChange={(ev) => {
                  const role = ev.target.value as AdminRole;
                  if (role !== e.role) { setError(null); setPending({ email: e.email, role }); }
                }}
              >
                <option value="owner">{ROLE_LABEL.owner}</option>
                <option value="operator">{ROLE_LABEL.operator}</option>
              </select>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        Para quitar acceso, saca el email de <code>ADMIN_EMAILS</code> (variable de entorno del servidor).
      </p>

      {pending && (
        <Dialog open onOpenChange={(o) => { if (!o) { setPending(null); setError(null); } }}>
          <DialogPopup>
            <DialogTitle>¿Cambiar el rol de {pending.email}?</DialogTitle>
            <p className="mt-2 text-sm">
              Nuevo rol: <b>{ROLE_LABEL[pending.role]}</b>. {ROLE_HELP[pending.role]}
            </p>
            {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
            <div className={DIALOG_FOOTER}>
              <DialogClose render={<Button variant="outline" className={DIALOG_ACTION}>Cancelar</Button>} />
              <Button className={DIALOG_ACTION} disabled={busy} onClick={confirm}>
                {busy ? 'Guardando…' : 'Cambiar rol'}
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </section>
  );
}
