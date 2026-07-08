import { z } from 'zod';

const bookingBase = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  adults: z.number().int().min(0).max(20),
  children: z.number().int().min(0).max(20),
  firstName: z.string().trim().min(1, 'Requerido').max(60),
  lastName: z.string().trim().min(1, 'Requerido').max(60),
  email: z.email('Correo inválido'),
});

const hasAttendee = {
  check: (b: { adults: number; children: number }) => b.adults + b.children >= 1,
  opts: { message: 'Debe incluir al menos una persona', path: ['adults'] },
};

export const bookingSchema = bookingBase.refine(hasAttendee.check, hasAttendee.opts);

// Venezuelan mobile: 0412/0414/0416/0422/0424/0426 + 7 digits
const VE_PHONE = /^04(12|14|16|22|24|26)\d{7}$/;

// Unrefined field definitions — exported so forms can .pick() individual fields
export const paymentFields = bookingBase.extend({
  idType: z.enum(['V', 'E', 'P', 'J']),
  idNumber: z.string().regex(/^\d{5,10}$/, 'Solo dígitos (5–10)'),
  phone: z.string().regex(VE_PHONE, 'Teléfono venezolano inválido (04XX...)'),
  bankCode: z.string().regex(/^\d{4}$/, 'Banco requerido'),
  otp: z.string().min(4, 'Clave requerida').max(12),
});

export const paymentSchema = paymentFields.refine(hasAttendee.check, hasAttendee.opts);

export type BookingInput = z.infer<typeof bookingSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
