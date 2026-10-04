// src/components/admin/profile-pill.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { browserClient } from '@/lib/db/browser-client';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION } from './ui-constants';

export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Dueño', operator: 'Operador' };

export function ProfilePill(props: { email: string; role: AdminRole; collapsed?: boolean }) {
  const router = useRouter();
  const initial = props.email.charAt(0).toUpperCase() || 'A';

  async function logout() {
    await browserClient().auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10',
        props.collapsed && 'flex-col',
      )}
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-teal font-heading text-base font-semibold text-navy"
      >
        {initial}
      </span>
      <div className={cn('min-w-0 flex-1', props.collapsed && 'sr-only')}>
        <p className="truncate text-sm text-white" title={props.email}>{props.email}</p>
        <span
          className={cn(
            'mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
            props.role === 'owner' ? 'bg-teal text-navy' : 'bg-white/15 text-white',
          )}
        >
          {ROLE_LABEL[props.role]}
        </span>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className={cn(
          ADMIN_ICON_ACTION,
          'grid shrink-0 cursor-pointer place-items-center rounded-xl text-white/70 transition-colors motion-reduce:transition-none',
          'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
        )}
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  );
}
