// src/components/admin/admin-drawer.tsx
'use client';

import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { AdminNavLinks } from './admin-nav-links';
import type { NavGroup } from './nav-config';
import { ProfilePill } from './profile-pill';
import { ADMIN_ICON_ACTION } from './ui-constants';

const ICON_BUTTON = cn(
  ADMIN_ICON_ACTION,
  'grid cursor-pointer place-items-center rounded-xl text-white transition-colors motion-reduce:transition-none',
  'hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-teal',
);

/** Mobile navigation: a modal drawer (focus trap, Escape, focus return via base-ui Dialog). */
export function AdminDrawer(props: { groups: NavGroup[]; pathname: string; email: string; role: AdminRole }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger aria-label="Abrir menú" className={ICON_BUTTON}>
        <Menu aria-hidden className="size-6" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-navy-deep/60 transition-opacity duration-200 motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-navy p-4 shadow-xl',
            'transition-transform duration-200 motion-reduce:transition-none',
            'data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Menú de administración</DialogPrimitive.Title>
          <div className="flex items-center justify-between">
            <Logo variant="chip" className="h-8 w-auto" sizes="96px" />
            <DialogPrimitive.Close aria-label="Cerrar menú" className={ICON_BUTTON}>
              <X aria-hidden className="size-6" />
            </DialogPrimitive.Close>
          </div>
          <AdminNavLinks groups={props.groups} pathname={props.pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <ProfilePill email={props.email} role={props.role} />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
