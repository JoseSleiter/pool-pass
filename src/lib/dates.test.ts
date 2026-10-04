import { describe, it, expect } from 'vitest';
import { shortDateEs, longDateEs, visitLabelEs, caracasHour, upcomingWeekend, visitLabel, shortDateLabel } from './dates';

describe('spanish date formatting (Caracas)', () => {
  it('shortDateEs renders weekday + day + month', () => {
    // 2030-01-15 is a Tuesday
    expect(shortDateEs('2030-01-15').toLowerCase()).toContain('mar');
    expect(shortDateEs('2030-01-15')).toContain('15');
  });
  it('longDateEs spells out the month', () => {
    const s = longDateEs('2030-01-15').toLowerCase();
    expect(s).toContain('martes');
    expect(s).toContain('enero');
  });
  it('visitLabelEs capitalizes tokens and keeps accents intact', () => {
    expect(visitLabelEs('2026-07-17')).toBe('Vie, 17 Jul 2026'); // Friday
    expect(visitLabelEs('2026-01-03')).toBe('Sáb, 03 Ene 2026'); // Saturday (accent)
    expect(visitLabelEs('2026-01-07')).toBe('Mié, 07 Ene 2026'); // Wednesday (accent)
  });
});

describe('caracasHour (UTC-4, no DST)', () => {
  it.each([
    ['2030-01-15T13:05:00Z', 9],
    ['2030-01-15T03:59:00Z', 23], // previous Caracas day, still late evening
    ['2030-01-15T04:30:00Z', 0],  // just after Caracas midnight
    ['2030-01-15T16:00:00-04:00', 16],
  ])('%s -> %i', (iso, hour) => {
    expect(caracasHour(iso)).toBe(hour);
  });
});

describe('upcomingWeekend', () => {
  it.each([
    ['2026-10-07', '2026-10-10', '2026-10-11'], // Wednesday -> next weekend
    ['2026-10-09', '2026-10-10', '2026-10-11'], // Friday
    ['2026-10-10', '2026-10-10', '2026-10-11'], // Saturday -> current weekend
    ['2026-10-11', '2026-10-10', '2026-10-11'], // Sunday -> current weekend
    ['2026-10-12', '2026-10-17', '2026-10-18'], // Monday -> following weekend
    ['2026-12-31', '2027-01-02', '2027-01-03'], // year rollover
  ])('%s -> %s / %s', (today, saturday, sunday) => {
    expect(upcomingWeekend(today)).toEqual({ saturday, sunday });
  });
});

describe('locale-aware labels (Caracas)', () => {
  it('visitLabel keeps the exact Spanish output of visitLabelEs', () => {
    expect(visitLabel('2026-07-17', 'es')).toBe('Vie, 17 Jul 2026');
    expect(visitLabel('2026-01-03', 'es')).toBe('Sáb, 03 Ene 2026');
  });
  it('visitLabel renders US English', () => {
    expect(visitLabel('2026-07-17', 'en')).toBe('Fri, Jul 17, 2026');
  });
  it('shortDateLabel reproduces the booking-card Spanish label', () => {
    // Previously: capitalize(shortDateEs(date).replace(/\./g, ''))
    expect(shortDateLabel('2030-01-15', 'es')).toBe('Mar, 15 Ene');
  });
  it('shortDateLabel renders US English', () => {
    expect(shortDateLabel('2030-01-15', 'en')).toBe('Tue, Jan 15');
  });
});
