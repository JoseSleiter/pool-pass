import { describe, it, expect } from 'vitest';
import { formatVePhone, normalizeVePhone, VE_MOBILE_PREFIXES } from './phone';
import { paymentFields } from './schemas';

const phoneRule = paymentFields.shape.phone;

describe('normalizeVePhone', () => {
  it.each([
    ['04141234567', '04141234567'],
    ['0414-123-4567', '04141234567'],
    ['(0414) 123 45 67', '04141234567'],
    ['+58 414 123 4567', '04141234567'],
    ['584141234567', '04141234567'],
    ['+58 0414 1234567', '04141234567'],
    ['4141234567', '04141234567'],
    ['041412345678999', '04141234567'],
    ['123', '123'],
    ['', ''],
    ['abc', ''],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeVePhone(raw)).toBe(expected);
  });
});

describe('formatVePhone', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['0414', '0414'],
    ['04141', '0414-1'],
    ['0414123', '0414-123'],
    ['04141234', '0414-123-4'],
    ['04141234567', '0414-123-4567'],
    ['0414-123-4567', '0414-123-4567'],
    ['+584141234567', '0414-123-4567'],
    ['123', '123'],
  ])('%j → %j', (raw, expected) => {
    expect(formatVePhone(raw)).toBe(expected);
  });

  it('backspacing the digit after a dash also drops the dash', () => {
    // Deleting "1" from "0414-1" leaves "0414-" in the input.
    expect(formatVePhone('0414-')).toBe('0414');
    expect(formatVePhone('0414-123-')).toBe('0414-123');
  });

  it('is idempotent', () => {
    expect(formatVePhone(formatVePhone('04241234567'))).toBe('0424-123-4567');
  });
});

describe('VE_MOBILE_PREFIXES stays in sync with paymentSchema', () => {
  it('every listed prefix + 7 digits passes the schema phone rule', () => {
    for (const prefix of VE_MOBILE_PREFIXES) {
      expect(phoneRule.safeParse(`${prefix}1234567`).success, prefix).toBe(true);
    }
  });

  it('no other 04XX prefix passes (the list is complete)', () => {
    for (let n = 0; n < 100; n++) {
      const prefix = `04${String(n).padStart(2, '0')}`;
      const listed = (VE_MOBILE_PREFIXES as readonly string[]).includes(prefix);
      expect(phoneRule.safeParse(`${prefix}1234567`).success, prefix).toBe(listed);
    }
  });

  it('a formatted number normalizes to exactly what the schema accepts', () => {
    expect(phoneRule.safeParse(normalizeVePhone('0424-555-1234')).success).toBe(true);
    expect(phoneRule.safeParse('0424-555-1234').success).toBe(false);
  });
});
