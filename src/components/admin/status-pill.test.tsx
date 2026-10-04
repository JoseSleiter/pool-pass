// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('confirmed: solid emerald with an icon', () => {
    render(<StatusPill reservation={{ status: 'confirmed', checked_in_at: null }} />);
    const pill = screen.getByText('Confirmada');
    expect(pill).toHaveClass('bg-emerald-700', 'text-white');
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('checked_in: soft blue outline with the 12h Caracas entry time', () => {
    render(<StatusPill reservation={{ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' }} />);
    expect(screen.getByText('Ingresó 10:15 a. m.')).toHaveClass('border-sky-300', 'bg-sky-50');
  });

  it('pending_payment: amber with a motion-safe pulse', () => {
    render(<StatusPill reservation={{ status: 'pending_payment', checked_in_at: null }} />);
    expect(screen.getByText('Pago en verificación')).toHaveClass('bg-amber-50');
    const ping = screen.getByTestId('pending-pulse').firstElementChild;
    expect(ping).toHaveClass('motion-safe:animate-ping');
    expect(ping?.className).not.toMatch(/(^|\s)animate-ping/);
  });

  it('failed / expired: muted gray', () => {
    render(<StatusPill reservation={{ status: 'expired', checked_in_at: null }} />);
    expect(screen.getByText('Expirada')).toHaveClass('bg-slate-100', 'text-slate-600');
  });
});
