// src/components/admin/nav-config.ts
import {
  CalendarDays, ChartLine, House, ReceiptText, ScrollText, Settings, type LucideIcon,
} from 'lucide-react';
import type { AdminRole } from '@/lib/db/admin-roles';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only owners see it (settings, roles, audit log — roadmap §3.2). */
  ownerOnly?: boolean;
  /** False until the route exists. The PR that ships the page flips it to true. */
  ready: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_HOME = '/admin';

/** Admin navigation (roadmap §3.4). Only `ready` items render. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operaciones',
    items: [
      { href: ADMIN_HOME, label: 'Hoy', icon: House, ready: true },
      { href: '/admin/reservations', label: 'Reservas', icon: CalendarDays, ready: false },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { href: '/admin/finance/transactions', label: 'Transacciones C2P', icon: ReceiptText, ready: false },
      { href: '/admin/finance/bcv', label: 'Tasas BCV', icon: ChartLine, ready: false },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/admin/settings', label: 'Configuración', icon: Settings, ownerOnly: true, ready: true },
      { href: '/admin/audit', label: 'Auditoría', icon: ScrollText, ownerOnly: true, ready: false },
    ],
  },
];

/** Groups with the items this role may see; groups left empty are dropped. */
export function visibleNavGroups(role: AdminRole, groups: NavGroup[] = NAV_GROUPS): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.ready && (!item.ownerOnly || role === 'owner')),
    }))
    .filter((group) => group.items.length > 0);
}

/** `/admin` is active only on itself; every other item also covers its nested routes. */
export function isActiveHref(href: string, pathname: string): boolean {
  if (href === ADMIN_HOME) return pathname === ADMIN_HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface Crumb {
  group: string;
  label: string;
  href: string;
}

/** Group + page for the topbar, from the most specific matching item (ready or not). */
export function breadcrumbFor(pathname: string, groups: NavGroup[] = NAV_GROUPS): Crumb | null {
  let best: Crumb | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (isActiveHref(item.href, pathname) && (!best || item.href.length > best.href.length)) {
        best = { group: group.label, label: item.label, href: item.href };
      }
    }
  }
  return best;
}
