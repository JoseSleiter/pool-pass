// src/components/admin/admin-nav-links.tsx
'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { isActiveHref, type NavGroup } from './nav-config';
import { ADMIN_NAV_ITEM } from './ui-constants';

export function AdminNavLinks(props: {
  groups: NavGroup[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navegación del panel" className="flex flex-col gap-5">
      {props.groups.map((group) => (
        <div key={group.label}>
          <p className={cn('mb-1 px-3 text-xs font-medium text-white/50', props.collapsed && 'sr-only')}>
            {group.label}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActiveHref(item.href, props.pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={props.onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={props.collapsed ? item.label : undefined}
                    className={cn(
                      ADMIN_NAV_ITEM,
                      'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal',
                      props.collapsed && 'justify-center px-0',
                      active
                        ? 'bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-teal'
                        : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon aria-hidden className={cn('size-5 shrink-0', active && 'text-teal')} />
                    <span className={cn(props.collapsed && 'sr-only')}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
