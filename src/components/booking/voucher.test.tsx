// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { shortDateLabel } from '@/lib/dates';
import { whatsappUrl } from '@/lib/landing-content';
import { Voucher } from './voucher';

const props = {
  reservation: {
    id: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    code: 'PP-AB3K9',
    totalUsd: 35,
    totalVes: 1277.5,
    bcvRate: 36.5,
  },
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Pérez',
  idLabel: 'V-12345678',
  date: '2026-10-24',
  party: { adults: 2, children: 1 },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Voucher', () => {
  it('renders the ticket with bold code, QR from /api/qr and the guest details', () => {
    renderWithI18n(<Voucher {...props} />);
    const ticket = screen.getByRole('article', { name: /pase del día/i });
    expect(within(ticket).getByTestId('reservation-code')).toHaveTextContent('PP-AB3K9');
    expect(within(ticket).getByTestId('reservation-code').className).toMatch(/font-bold/);
    const qr = within(ticket).getByAltText(/código qr/i);
    expect(qr).toHaveAttribute('src', `/api/qr/${props.reservation.id}`);
    expect(qr).toHaveAttribute('width', '208');
    expect(ticket).toHaveTextContent('Ana Pérez');
    expect(ticket).toHaveTextContent('V-12345678');
    expect(ticket).toHaveTextContent('$35.00 USD · Bs. 1277.50');
  });

  it('lists three entry steps, the first with the visit date', () => {
    renderWithI18n(<Voucher {...props} />);
    const steps = within(screen.getByRole('list', { name: /cómo entrar/i })).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(`Llega el ${shortDateLabel(props.date, 'es')} con tu documento de identidad.`);
  });

  it('prints with window.print, and the print stylesheet keeps only the ticket', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderWithI18n(<Voucher {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /descargar \/ imprimir/i }));
    expect(print).toHaveBeenCalledOnce();

    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toContain('@media print');
    expect(css).toContain('[data-print-ticket]');
    const ticket = screen.getByRole('article', { name: /pase del día/i });
    expect(ticket).toHaveAttribute('data-print-ticket');
    expect(within(ticket).queryByRole('button')).not.toBeInTheDocument();
    expect(within(ticket).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shares only club, date and code on WhatsApp (no recipient, no personal data)', () => {
    renderWithI18n(<Voucher {...props} />);
    const link = screen.getByRole('link', { name: /compartir por whatsapp/i });
    const url = new URL(link.getAttribute('href')!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/');
    const text = url.searchParams.get('text')!;
    expect(text).toBe(
      `Mi pase para Complejo Turístico Villa Victoria el ${shortDateLabel(props.date, 'es')} · Código PP-AB3K9`
    );
    for (const secret of ['Ana', 'Pérez', '12345678', 'ana@example.com', '1277', props.reservation.id]) {
      expect(text).not.toContain(secret);
    }
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps the help link to the club WhatsApp', () => {
    renderWithI18n(<Voucher {...props} />);
    expect(screen.getByRole('link', { name: /escríbenos por whatsapp/i })).toHaveAttribute('href', whatsappUrl());
  });

  it('renders in English', () => {
    renderWithI18n(<Voucher {...props} />, { locale: 'en' });
    expect(screen.getByRole('button', { name: /download \/ print/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /share on whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /how to get in/i })).toBeInTheDocument();
  });
});
