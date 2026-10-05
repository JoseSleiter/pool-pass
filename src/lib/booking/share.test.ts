import { describe, it, expect } from 'vitest';
import { whatsappShareUrl, voucherShareText } from './share';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('whatsappShareUrl', () => {
  it('builds a wa.me link with no recipient, so the user picks the contact', () => {
    const url = new URL(whatsappShareUrl('hola'));
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/');
  });

  it('URL-encodes the text and round-trips it exactly', () => {
    const text = 'Mi pase para Complejo Turístico Villa Victoria el Sáb, 24 Oct · Código PP-AB3K9 & más';
    const href = whatsappShareUrl(text);
    expect(href).not.toContain(' ');
    expect(new URL(href).searchParams.get('text')).toBe(text);
  });
});

describe('voucherShareText', () => {
  const voucher = {
    club: 'Complejo Turístico Villa Victoria',
    code: 'PP-AB3K9',
    date: 'Sáb, 24 Oct',
    name: 'Ana Pérez',
    idLabel: 'V-12345678',
    party: '2 adultos, 1 niño',
    totalUsd: 35,
    totalVes: 1277.5,
  };

  it('carries every voucher detail and the entry steps, in Spanish', () => {
    expect(voucherShareText(es.done, voucher)).toBe(
      [
        'Pase del día · Complejo Turístico Villa Victoria',
        'Código: PP-AB3K9',
        'Nombre: Ana Pérez',
        'Documento: V-12345678',
        'Fecha: Sáb, 24 Oct',
        'Asistentes: 2 adultos, 1 niño',
        'Pagado: $35.00 USD · Bs. 1277.50',
        '',
        'Cómo entrar:',
        '1. Llega el Sáb, 24 Oct con tu documento de identidad.',
        '2. En la entrada, muestra este código QR desde tu teléfono o impreso.',
        '3. El personal lo escanea, revisa tu documento y registra tu entrada.',
      ].join('\n'),
    );
  });

  it('uses the English labels in English', () => {
    const text = voucherShareText(en.done, { ...voucher, date: 'Sat, Oct 24', party: '2 adults, 1 child' });
    expect(text).toContain('Day pass · Complejo Turístico Villa Victoria');
    expect(text).toContain('Code: PP-AB3K9');
    expect(text).toContain('Paid: $35.00 USD · Bs. 1277.50');
    expect(text).toContain('1. Arrive on Sat, Oct 24 with your ID.');
  });
});
