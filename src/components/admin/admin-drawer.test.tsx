// src/components/admin/admin-drawer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut: vi.fn() } }) }));
// Plain anchor so clicking a link does not need the App Router context.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { AdminDrawer } from './admin-drawer';
import { visibleNavGroups } from './nav-config';

function renderDrawer() {
  render(
    <AdminDrawer groups={visibleNavGroups('owner')} pathname="/admin" email="dueno@club.com" role="owner" />,
  );
  return screen.getByRole('button', { name: 'Abrir menú' });
}

describe('AdminDrawer', () => {
  it('has a 44px trigger announcing a closed dialog', () => {
    const trigger = renderDrawer();
    expect(trigger).toHaveClass('size-11');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a named dialog with nav and profile, and moves focus inside', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Menú de administración' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes with the close button', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes after choosing a destination', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('link', { name: 'Configuración' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
