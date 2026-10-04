// src/components/admin/admin-shell.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { AdminRole } from '@/lib/db/admin-roles';
import { cn } from '@/lib/utils';
import { AdminDrawer } from './admin-drawer';
import { AdminNavLinks } from './admin-nav-links';
import { CommandSearch, CommandSearchButton } from './command-search';
import { visibleNavGroups } from './nav-config';
import { ProfilePill } from './profile-pill';
import { Topbar } from './topbar';
import type { ShellStatus } from './topbar-data';
import { ADMIN_ICON_ACTION } from './ui-constants';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

export interface AdminUser {
  email: string;
  role: AdminRole;
}

export function AdminShell(props: { user: AdminUser; status: ShellStatus; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [searchOpen, setSearchOpen] = useState(false);
  const groups = visibleNavGroups(props.user.role);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Desktop sidebar */}
      <aside
        aria-label="Menú lateral"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col gap-6 bg-navy p-3 transition-[width] duration-200 motion-reduce:transition-none md:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <Logo variant="chip" className={collapsed ? 'h-6 w-auto' : 'h-9 w-auto'} sizes="112px" />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar-nav"
            className={cn(
              ADMIN_ICON_ACTION,
              'grid cursor-pointer place-items-center rounded-xl text-white/70 transition-colors motion-reduce:transition-none',
              'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
            )}
          >
            {collapsed
              ? <PanelLeftOpen aria-hidden className="size-5" />
              : <PanelLeftClose aria-hidden className="size-5" />}
          </button>
        </div>
        <CommandSearchButton onClick={() => setSearchOpen(true)} compact={collapsed} />
        <div id="admin-sidebar-nav" className="min-h-0 flex-1 overflow-y-auto">
          <AdminNavLinks groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>
        <ProfilePill email={props.user.email} role={props.user.role} collapsed={collapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-navy px-3 py-2 md:hidden">
        <Logo variant="chip" className="h-7 w-auto" sizes="96px" />
        <div className="flex items-center gap-1">
          <CommandSearchButton onClick={() => setSearchOpen(true)} compact />
          <AdminDrawer groups={groups} pathname={pathname} email={props.user.email} role={props.user.role} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar status={props.status} />
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>

      {/* Global ⌘K / Ctrl+K reservation search (roadmap §2). */}
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
