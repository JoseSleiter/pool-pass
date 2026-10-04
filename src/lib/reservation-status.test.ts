import { describe, it, expect } from 'vitest';
import {
  STATUS_CHIP_CLASS, STATUS_NAME_ES, STATUS_ORDER, caracasDateTime12, caracasTime12, statusLabelEs,
} from './reservation-status';

describe('caracasTime12', () => {
  it('formats Caracas time on a 12-hour clock with plain spaces', () => {
    expect(caracasTime12('2030-01-15T14:15:00Z')).toBe('10:15 a. m.');
    expect(caracasTime12('2030-01-15T20:05:00Z')).toBe('4:05 p. m.');
  });
});

describe('caracasDateTime12', () => {
  it('formats date and 12-hour time in Caracas', () => {
    expect(caracasDateTime12('2030-01-10T10:00:00Z')).toMatch(/^10 ene\.? 2030, 6:00 a\. m\.$/);
  });
});

describe('statusLabelEs', () => {
  it('shows the 12-hour entry time for checked-in reservations', () => {
    expect(statusLabelEs({ status: 'checked_in', checked_in_at: '2030-01-15T14:15:00Z' })).toBe('Ingresó 10:15 a. m.');
    expect(statusLabelEs({ status: 'checked_in', checked_in_at: null })).toBe('Ingresó');
  });

  it('labels the other statuses', () => {
    expect(statusLabelEs({ status: 'pending_payment', checked_in_at: null })).toBe('Pago en verificación');
    expect(statusLabelEs({ status: 'confirmed', checked_in_at: null })).toBe('Confirmada');
    expect(statusLabelEs({ status: 'failed', checked_in_at: null })).toBe('Fallida');
    expect(statusLabelEs({ status: 'expired', checked_in_at: null })).toBe('Expirada');
  });
});

describe('status palette (md2 §4)', () => {
  it('confirmed is solid emerald, checked_in a soft blue outline, pending amber, failed/expired muted gray', () => {
    expect(STATUS_CHIP_CLASS.confirmed).toContain('bg-emerald-700');
    expect(STATUS_CHIP_CLASS.confirmed).toContain('text-white');
    expect(STATUS_CHIP_CLASS.checked_in).toContain('border-sky-300');
    expect(STATUS_CHIP_CLASS.checked_in).toContain('bg-sky-50');
    expect(STATUS_CHIP_CLASS.pending_payment).toContain('bg-amber-50');
    expect(STATUS_CHIP_CLASS.failed).toContain('bg-slate-100');
    expect(STATUS_CHIP_CLASS.failed).toBe(STATUS_CHIP_CLASS.expired);
  });

  it('has one canonical order and a short name for every status', () => {
    expect(STATUS_ORDER).toEqual(['pending_payment', 'confirmed', 'checked_in', 'failed', 'expired']);
    expect(STATUS_ORDER.map((s) => STATUS_NAME_ES[s])).toEqual(['Pendiente', 'Confirmada', 'Ingresó', 'Fallida', 'Expirada']);
  });
});
