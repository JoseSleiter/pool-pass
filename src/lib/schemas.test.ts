import { describe, it, expect } from 'vitest';
import { bookingSchema, paymentSchema } from './schemas';

const validBooking = {
  date: '2030-01-15',
  adults: 2,
  children: 0,
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@example.com',
};

const validPayment = {
  ...validBooking,
  idType: 'V',
  idNumber: '12345678',
  phone: '04141234567',
  bankCode: '0105',
  otp: '12345678',
};

describe('bookingSchema', () => {
  it('accepts a valid booking', () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });
  it('requires at least 1 adult', () => {
    expect(bookingSchema.safeParse({ ...validBooking, adults: 0 }).success).toBe(false);
  });
  it('rejects malformed dates', () => {
    expect(bookingSchema.safeParse({ ...validBooking, date: '15/01/2030' }).success).toBe(false);
  });
});

describe('paymentSchema', () => {
  it('accepts a valid payment payload', () => {
    expect(paymentSchema.safeParse(validPayment).success).toBe(true);
  });
  it.each(['4141234567', '04991234567', '0414123456', '041412345678'])(
    'rejects invalid Venezuelan phone %s',
    (phone) => {
      expect(paymentSchema.safeParse({ ...validPayment, phone }).success).toBe(false);
    }
  );
  it('rejects unknown ID types', () => {
    expect(paymentSchema.safeParse({ ...validPayment, idType: 'X' }).success).toBe(false);
  });
  it('rejects non-numeric ID numbers', () => {
    expect(paymentSchema.safeParse({ ...validPayment, idNumber: '12A45' }).success).toBe(false);
  });
});
