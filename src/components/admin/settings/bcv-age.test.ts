import { describe, it, expect } from 'vitest';
import { rateAgeLabel, rateStampEs, rateFreshness } from './bcv-age';

const NOW = Date.parse('2030-01-15T16:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('rateAgeLabel', () => {
  it('uses minutes, hours and days in Spanish with singular/plural', () => {
    expect(rateAgeLabel(ago(20_000), NOW)).toBe('hace menos de 1 minuto');
    expect(rateAgeLabel(ago(1 * MIN), NOW)).toBe('hace 1 minuto');
    expect(rateAgeLabel(ago(30 * MIN), NOW)).toBe('hace 30 minutos');
    expect(rateAgeLabel(ago(1 * HOUR), NOW)).toBe('hace 1 hora');
    expect(rateAgeLabel(ago(5 * HOUR + 59 * MIN), NOW)).toBe('hace 5 horas');
    expect(rateAgeLabel(ago(24 * HOUR), NOW)).toBe('hace 1 día');
    expect(rateAgeLabel(ago(72 * HOUR), NOW)).toBe('hace 3 días');
  });

  it('treats a future timestamp (clock skew) as just now', () => {
    expect(rateAgeLabel(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('hace menos de 1 minuto');
  });
});

describe('rateStampEs', () => {
  it('formats date and time in Caracas time (UTC-4)', () => {
    const s = rateStampEs('2026-10-04T17:05:00Z');
    expect(s).toContain('4 oct');
    expect(s).toContain('13:05');
  });

  it('uses the Caracas calendar day, not the UTC one', () => {
    const s = rateStampEs('2026-10-05T02:00:00Z'); // 22:00 on Oct 4 in Caracas
    expect(s).toContain('4 oct');
    expect(s).toContain('22:00');
  });
});

describe('rateFreshness', () => {
  it('is fresh < 1 h, stale < 24 h, expired after', () => {
    expect(rateFreshness(ago(59 * MIN), NOW)).toBe('fresh');
    expect(rateFreshness(ago(2 * HOUR), NOW)).toBe('stale');
    expect(rateFreshness(ago(25 * HOUR), NOW)).toBe('expired');
  });
});
