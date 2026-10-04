// src/components/admin/profile-pill.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
const refresh = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock('@/lib/db/browser-client', () => ({ browserClient: () => ({ auth: { signOut } }) }));

import { ProfilePill } from './profile-pill';

describe('ProfilePill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the email and "Dueño" for owners', () => {
    render(<ProfilePill email="dueno@club.com" role="owner" />);
    expect(screen.getByText('dueno@club.com')).toBeInTheDocument();
    expect(screen.getByText('Dueño')).toBeInTheDocument();
  });

  it('shows "Operador" for operators', () => {
    render(<ProfilePill email="op@club.com" role="operator" />);
    expect(screen.getByText('Operador')).toBeInTheDocument();
  });

  it('signs out and goes to the login', async () => {
    render(<ProfilePill email="op@club.com" role="operator" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/admin/login');
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps email and role readable by screen readers when collapsed', () => {
    render(<ProfilePill email="op@club.com" role="operator" collapsed />);
    expect(screen.getByText('op@club.com').closest('div')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('size-11');
  });
});
