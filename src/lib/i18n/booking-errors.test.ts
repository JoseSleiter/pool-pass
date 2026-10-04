import { describe, it, expect } from 'vitest';
import { submitErrorMessage } from './booking-errors';
import { es } from './es';
import { en } from './en';

describe('submitErrorMessage', () => {
  it('reproduces the current Spanish copy', () => {
    expect(submitErrorMessage({ ok: false, error: 'no_attendees' }, es))
      .toBe('Agrega al menos un asistente para continuar.');
    expect(submitErrorMessage({ ok: false, error: 'capacity', remaining: 3 }, es))
      .toBe('Ya no hay cupo suficiente para esa fecha. Quedan 3 puestos. Elige otra fecha.');
    expect(submitErrorMessage({ ok: false, error: 'payment_declined', message: 'Clave inválida' }, es))
      .toBe('Pago rechazado: Clave inválida. Genera una nueva clave C2P e intenta de nuevo.');
  });

  it('matches the server messages word for word in Spanish', () => {
    // Literals copied from src/app/actions/booking.ts and src/lib/booking/process.ts.
    expect(submitErrorMessage({ ok: false, error: 'rate_limited', message: 'x' }, es))
      .toBe('Demasiados intentos seguidos. Espera un momento e intenta de nuevo.');
    expect(submitErrorMessage({ ok: false, error: 'rate_unavailable', message: 'x' }, es))
      .toBe('No pudimos obtener la tasa BCV. Intenta de nuevo más tarde.');
    expect(submitErrorMessage({ ok: false, error: 'payment_pending', message: 'x' }, es))
      .toBe('Tu pago está siendo verificado. Te contactaremos con la confirmación.');
    expect(submitErrorMessage({ ok: false, error: 'validation', message: 'Datos inválidos' }, es))
      .toBe('Datos inválidos');
  });

  it('translates to English, keeping the bank reason verbatim', () => {
    expect(submitErrorMessage({ ok: false, error: 'capacity', remaining: 1 }, en))
      .toBe("There's no longer enough room on that date (spots left: 1). Please pick another date.");
    expect(submitErrorMessage({ ok: false, error: 'payment_declined', message: 'Clave inválida' }, en))
      .toBe('Payment declined: Clave inválida. Generate a new C2P key and try again.');
  });
});
