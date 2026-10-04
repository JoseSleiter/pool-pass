// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({ adminUpsertRole: vi.fn().mockResolvedValue({ ok: true }) }));

import { RolesPanel } from './roles-panel';
import { adminUpsertRole } from '@/app/admin/actions';
import type { AdminAccessEntry } from '@/app/admin/actions';

const entries: AdminAccessEntry[] = [
  { email: 'admin@club.com', role: 'owner', explicit: false },
  { email: 'ops@club.com', role: 'operator', explicit: true },
  { email: 'boss@club.com', role: 'owner', explicit: true },
];

const row = (email: string) => screen.getByText(email).closest('li')!;

beforeEach(() => vi.clearAllMocks());

describe('RolesPanel', () => {
  it('lists every allowlisted email with its role and marks defaults and yourself', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(within(row('admin@club.com')).getByText('(tú)')).toBeInTheDocument();
    expect(within(row('admin@club.com')).getByText('por defecto')).toBeInTheDocument();
    expect(within(row('ops@club.com')).queryByText('por defecto')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Rol de ops@club.com' })).toHaveValue('operator');
    expect(screen.getByRole('combobox', { name: 'Rol de boss@club.com' })).toHaveValue('owner');
  });

  it('blocks changing your own role and explains why', () => {
    render(<RolesPanel entries={entries} currentEmail="Admin@Club.com" />);
    const own = screen.getByRole('combobox', { name: 'Rol de admin@club.com' });
    expect(own).toBeDisabled();
    expect(own).toHaveAccessibleDescription(/No puedes cambiar tu propio rol/);
  });

  it('asks for confirmation and then changes the role', async () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de ops@club.com' }), 'owner');
    expect(screen.getByText('¿Cambiar el rol de ops@club.com?')).toBeInTheDocument();
    expect(screen.getByText(/Acceso total/)).toBeInTheDocument();
    expect(adminUpsertRole).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(adminUpsertRole).toHaveBeenCalledWith({ email: 'ops@club.com', role: 'owner' });
    expect(refresh).toHaveBeenCalled();
  });

  it('cancelling the confirmation changes nothing', async () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de boss@club.com' }), 'operator');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(adminUpsertRole).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Rol de boss@club.com' })).toHaveValue('owner');
  });

  it('shows the server error inside the dialog', async () => {
    vi.mocked(adminUpsertRole).mockResolvedValueOnce({ ok: false, message: 'No se pudo guardar.' });
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rol de boss@club.com' }), 'operator');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('explains how to remove access', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /Para quitar acceso, saca el email de ADMIN_EMAILS/.test(el.textContent ?? '')),
    ).toBeInTheDocument();
  });

  it('role selects are 44px tall', () => {
    render(<RolesPanel entries={entries} currentEmail="admin@club.com" />);
    expect(screen.getByRole('combobox', { name: 'Rol de ops@club.com' }).className).toContain('h-11');
  });
});
