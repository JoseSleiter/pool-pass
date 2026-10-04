import { describe, it, expect } from 'vitest';
import { paymentSchema } from '@/lib/schemas';
import { validationKey } from './validation';
import { es } from './es';
import { en } from './en';

const valid = {
  date: '2030-01-15', adults: 2, children: 0,
  firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
  idType: 'V', idNumber: '12345678', phone: '04141234567', bankCode: '0105', otp: '123456',
};

function issuesOf(payload: unknown) {
  const r = paymentSchema.safeParse(payload);
  if (r.success) throw new Error('expected the payload to be invalid');
  return r.error.issues;
}

describe('validationKey', () => {
  it('maps every custom schema message to an identical Spanish dictionary entry', () => {
    const issues = issuesOf({
      ...valid, date: '15/01/2030', firstName: '', lastName: '', email: 'nope',
      idNumber: '12A', phone: '123', bankCode: '', otp: '',
    });
    expect(issues.length).toBeGreaterThanOrEqual(8);
    for (const issue of issues) {
      expect(es.validation[validationKey(issue)], String(issue.path[0])).toBe(issue.message);
    }
  });

  it('maps the no-attendees refinement', () => {
    const [issue] = issuesOf({ ...valid, adults: 0, children: 0 });
    expect(validationKey(issue)).toBe('noAttendees');
    expect(es.validation.noAttendees).toBe(issue.message);
  });

  it('maps max-length violations to tooLong instead of zod default English', () => {
    const [issue] = issuesOf({ ...valid, firstName: 'x'.repeat(61) });
    expect(validationKey(issue)).toBe('tooLong');
  });

  it('has an English message for the phone error', () => {
    const [issue] = issuesOf({ ...valid, phone: '123' });
    expect(en.validation[validationKey(issue)]).toBe('Invalid Venezuelan phone number (04XX...)');
  });
});
