/**
 * Venezuelan mobile numbers for the C2P form.
 *
 * The form stores and submits the digits-only national form ("04141234567"),
 * which is what paymentSchema's phone rule accepts (src/lib/schemas.ts,
 * VE_PHONE); the input only *displays* "0414-123-4567". phone.test.ts checks
 * this list against that rule, so the two cannot drift apart.
 */
export const VE_MOBILE_PREFIXES = ['0412', '0414', '0416', '0422', '0424', '0426'] as const;

const NATIONAL_LENGTH = 11;

/**
 * Whatever the user typed, pasted or autofilled → digits-only national form.
 * - Drops spaces, dashes, dots and parentheses.
 * - "+58 414…" / "58414…" / "+58 0414…" → "0414…" (country code → trunk 0).
 * - "414…" (autofill without the trunk 0) → "0414…".
 * - Caps at 11 digits.
 */
export function normalizeVePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('58')) {
    digits = `0${digits.slice(2).replace(/^0+/, '')}`;
  } else if (digits.startsWith('4')) {
    digits = `0${digits}`;
  }
  return digits.slice(0, NATIONAL_LENGTH);
}

/** Display form, built progressively while typing: "0414", "0414-123", "0414-123-4567". */
export function formatVePhone(value: string): string {
  const d = normalizeVePhone(value);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}
