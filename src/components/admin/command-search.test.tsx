// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import {
  CommandSearch, CommandSearchButton, commandSearchHref, isCommandK, shortcutLabel,
} from './command-search';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <CommandSearchButton onClick={() => setOpen(true)} />
      <CommandSearch open={open} onOpenChange={setOpen} />
    </>
  );
}

const field = () => screen.getByRole('textbox', { name: 'Nombre, código o cédula' });

beforeEach(() => router.push.mockReset());

describe('command search helpers', () => {
  it('builds the reservations URL from the query', () => {
    expect(commandSearchHref('  ana pérez ')).toBe('/admin/reservations?q=ana+p%C3%A9rez');
    expect(commandSearchHref('   ')).toBe('/admin/reservations');
  });

  it('labels the shortcut per platform', () => {
    expect(shortcutLabel('MacIntel')).toBe('⌘K');
    expect(shortcutLabel('iPhone')).toBe('⌘K');
    expect(shortcutLabel('Win32')).toBe('Ctrl K');
  });

  it('recognizes only Cmd+K / Ctrl+K', () => {
    const k = { key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
    expect(isCommandK({ ...k, metaKey: true })).toBe(true);
    expect(isCommandK({ ...k, ctrlKey: true, key: 'K' })).toBe(true);
    expect(isCommandK(k)).toBe(false);
    expect(isCommandK({ ...k, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isCommandK({ ...k, ctrlKey: true, key: 'j' })).toBe(false);
  });
});

describe('CommandSearch', () => {
  it('opens with Ctrl+K or Cmd+K and focuses the search field', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it('opens with Cmd+K too and ignores plain K', async () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: 'k' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar reservas' })).toBeInTheDocument();
  });

  it('Enter navigates to /admin/reservations?q=… and closes', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar reservas' }));
    await screen.findByRole('dialog', { name: 'Buscar reservas' });
    await userEvent.type(field(), 'PP-AB12{Enter}');
    expect(router.push).toHaveBeenCalledWith('/admin/reservations?q=PP-AB12');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Escape closes without navigating', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar reservas' }));
    await screen.findByRole('dialog', { name: 'Buscar reservas' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.push).not.toHaveBeenCalled();
  });

  it('the trigger is a 44px button that announces the shortcut', () => {
    render(<CommandSearchButton onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Buscar reservas' });
    expect(button).toHaveClass('min-h-11');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });
});
