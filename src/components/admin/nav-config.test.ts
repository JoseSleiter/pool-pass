// src/components/admin/nav-config.test.ts
import { describe, it, expect } from 'vitest';
import { House } from 'lucide-react';
import {
  NAV_GROUPS, visibleNavGroups, isActiveHref, breadcrumbFor, type NavGroup,
} from './nav-config';

const hrefs = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));

describe('NAV_GROUPS (roadmap §3.4 contract)', () => {
  it('declares every admin route in its group, with finance and audit ready', () => {
    const shape = NAV_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.map((i) => ({ href: i.href, label: i.label, ownerOnly: !!i.ownerOnly, ready: i.ready })),
    }));
    expect(shape).toEqual([
      { label: 'Operaciones', items: [
        { href: '/admin', label: 'Hoy', ownerOnly: false, ready: true },
        { href: '/admin/reservations', label: 'Reservas', ownerOnly: false, ready: false },
      ] },
      { label: 'Finanzas', items: [
        { href: '/admin/finance/transactions', label: 'Transacciones C2P', ownerOnly: false, ready: true },
        { href: '/admin/finance/bcv', label: 'Tasas BCV', ownerOnly: false, ready: true },
      ] },
      { label: 'Gestión', items: [
        { href: '/admin/settings', label: 'Configuración', ownerOnly: true, ready: true },
        { href: '/admin/audit', label: 'Auditoría', ownerOnly: true, ready: true },
      ] },
    ]);
  });
});

describe('visibleNavGroups', () => {
  it('shows an owner only the ready items and drops empty groups', () => {
    const groups = visibleNavGroups('owner');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones', 'Finanzas', 'Gestión']);
    expect(hrefs(groups)).toEqual([
      '/admin', '/admin/finance/transactions', '/admin/finance/bcv', '/admin/settings', '/admin/audit',
    ]);
  });

  it('hides owner-only items from an operator', () => {
    const groups = visibleNavGroups('operator');
    expect(groups.map((g) => g.label)).toEqual(['Operaciones', 'Finanzas']);
    expect(hrefs(groups)).toEqual(['/admin', '/admin/finance/transactions', '/admin/finance/bcv']);
  });

  it('applies ready and role independently', () => {
    const fixture: NavGroup[] = [{
      label: 'G',
      items: [
        { href: '/a', label: 'A', icon: House, ready: true },
        { href: '/b', label: 'B', icon: House, ready: false },
        { href: '/c', label: 'C', icon: House, ready: true, ownerOnly: true },
        { href: '/d', label: 'D', icon: House, ready: false, ownerOnly: true },
      ],
    }];
    expect(hrefs(visibleNavGroups('owner', fixture))).toEqual(['/a', '/c']);
    expect(hrefs(visibleNavGroups('operator', fixture))).toEqual(['/a']);
  });
});

describe('isActiveHref', () => {
  it('matches /admin only exactly', () => {
    expect(isActiveHref('/admin', '/admin')).toBe(true);
    expect(isActiveHref('/admin', '/admin/settings')).toBe(false);
  });

  it('matches nested routes of other items, not lookalike prefixes', () => {
    expect(isActiveHref('/admin/settings', '/admin/settings')).toBe(true);
    expect(isActiveHref('/admin/settings', '/admin/settings/roles')).toBe(true);
    expect(isActiveHref('/admin/settings', '/admin/settingsx')).toBe(false);
  });
});

describe('breadcrumbFor', () => {
  it('names group and page for known routes', () => {
    expect(breadcrumbFor('/admin')).toEqual({ group: 'Operaciones', label: 'Hoy', href: '/admin' });
    expect(breadcrumbFor('/admin/settings')).toEqual({ group: 'Gestión', label: 'Configuración', href: '/admin/settings' });
  });

  it('prefers the most specific item for nested routes', () => {
    expect(breadcrumbFor('/admin/finance/bcv')).toEqual({ group: 'Finanzas', label: 'Tasas BCV', href: '/admin/finance/bcv' });
    expect(breadcrumbFor('/admin/reservations/abc')).toEqual({ group: 'Operaciones', label: 'Reservas', href: '/admin/reservations' });
  });

  it('returns null for routes outside the nav', () => {
    expect(breadcrumbFor('/admin/unknown')).toBeNull();
  });
});
