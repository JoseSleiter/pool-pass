import { describe, it, expect } from 'vitest';
import { whatsappShareUrl } from './share';

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
