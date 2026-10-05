// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test/i18n';
import { shortDateLabel } from '@/lib/dates';
import { whatsappUrl } from '@/lib/landing-content';
import { Voucher } from './voucher';
import { voucherShareText } from '@/lib/booking/share';
import { es } from '@/lib/i18n/es';

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

  it('keeps a print stylesheet that prints only the ticket (Ctrl/Cmd+P)', () => {
    renderWithI18n(<Voucher {...props} />);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toContain('@media print');
    expect(css).toContain('[data-print-ticket]');
    const ticket = screen.getByRole('article', { name: /pase del día/i });
    expect(ticket).toHaveAttribute('data-print-ticket');
    expect(within(ticket).queryByRole('button')).not.toBeInTheDocument();
    expect(within(ticket).queryByRole('link')).not.toBeInTheDocument();
  });

  it('"Descargar QR" downloads only the QR image, named after the code', () => {
    renderWithI18n(<Voucher {...props} />);
    const link = screen.getByRole('link', { name: /descargar qr/i });
    expect(link).toHaveAttribute('href', `/api/qr/${props.reservation.id}`);
    expect(link).toHaveAttribute('download', 'PP-AB3K9-qr.png');
  });

  describe('Compartir por WhatsApp', () => {
    const fullText = () =>
      voucherShareText(es.done, {
        club: 'Complejo Turístico Villa Victoria',
        code: 'PP-AB3K9',
        date: shortDateLabel(props.date, 'es'),
        name: 'Ana Pérez',
        idLabel: 'V-12345678',
        party: '2 adultos, 1 niño',
        totalUsd: 35,
        totalVes: 1277.5,
      });

    function stubQrFetch() {
      const png = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
      return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    }

    function stubWebShare(share: (data: ShareData) => Promise<void>) {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(share) });
    }

    afterEach(() => {
      // jsdom has no Web Share API: remove the stubs so other tests see the real (absent) API.
      delete (navigator as { canShare?: unknown }).canShare;
      delete (navigator as { share?: unknown }).share;
    });

    it('shares the QR image plus the full voucher text through the system share sheet', async () => {
      const fetchSpy = stubQrFetch();
      stubWebShare(async () => {});
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      renderWithI18n(<Voucher {...props} />);
      const button = screen.getByRole('button', { name: /compartir por whatsapp/i });
      await waitFor(() => expect(button).toHaveAttribute('data-share-mode', 'file'));
      expect(fetchSpy).toHaveBeenCalledWith(`/api/qr/${props.reservation.id}`);

      await userEvent.click(button);
      expect(navigator.share).toHaveBeenCalledOnce();
      const data = vi.mocked(navigator.share).mock.calls[0][0]!;
      expect(data.text).toBe(fullText());
      expect(data.files).toHaveLength(1);
      expect(data.files![0].name).toBe('PP-AB3K9-qr.png');
      expect(data.files![0].type).toBe('image/png');
      expect(open).not.toHaveBeenCalled();
    });

    it('does nothing more when the guest cancels the share sheet', async () => {
      stubQrFetch();
      stubWebShare(async () => { throw new DOMException('cancelled', 'AbortError'); });
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      renderWithI18n(<Voucher {...props} />);
      const button = screen.getByRole('button', { name: /compartir por whatsapp/i });
      await waitFor(() => expect(button).toHaveAttribute('data-share-mode', 'file'));
      await userEvent.click(button);
      expect(open).not.toHaveBeenCalled();
    });

    it('falls back to WhatsApp with the full voucher as text when files cannot be shared', async () => {
      stubQrFetch();
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      renderWithI18n(<Voucher {...props} />);
      const button = screen.getByRole('button', { name: /compartir por whatsapp/i });
      expect(button).toHaveAttribute('data-share-mode', 'text');
      await userEvent.click(button);
      expect(open).toHaveBeenCalledOnce();
      const [href, target, features] = open.mock.calls[0];
      const url = new URL(String(href));
      expect(url.origin).toBe('https://wa.me');
      expect(url.pathname).toBe('/');
      expect(url.searchParams.get('text')).toBe(fullText());
      expect(target).toBe('_blank');
      expect(features).toBe('noopener,noreferrer');
    });

    it('falls back to the text link if the share sheet fails for another reason', async () => {
      stubQrFetch();
      stubWebShare(async () => { throw new Error('not allowed'); });
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      renderWithI18n(<Voucher {...props} />);
      const button = screen.getByRole('button', { name: /compartir por whatsapp/i });
      await waitFor(() => expect(button).toHaveAttribute('data-share-mode', 'file'));
      await userEvent.click(button);
      await waitFor(() => expect(open).toHaveBeenCalledOnce());
      expect(new URL(String(open.mock.calls[0][0])).searchParams.get('text')).toBe(fullText());
    });
  });

  it('keeps the help link to the club WhatsApp', () => {
    renderWithI18n(<Voucher {...props} />);
    expect(screen.getByRole('link', { name: /escríbenos por whatsapp/i })).toHaveAttribute('href', whatsappUrl());
  });

  it('renders in English', () => {
    renderWithI18n(<Voucher {...props} />, { locale: 'en' });
    expect(screen.getByRole('link', { name: /download qr/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share on whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /how to get in/i })).toBeInTheDocument();
  });
});
