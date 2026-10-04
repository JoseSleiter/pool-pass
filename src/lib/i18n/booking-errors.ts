import type { BookingResult } from '@/lib/booking/process';
import type { Dictionary } from './types';
import { interpolate } from './format';

/** A failed submit, plus the client-only "nobody attending" guard. */
export type SubmitFailure =
  | Extract<BookingResult, { ok: false }>
  | { ok: false; error: 'no_attendees' };

/**
 * Text for a failed submit, in the current language. Stored failures (not
 * strings) are rendered through this, so switching language re-translates an
 * error that is already on screen.
 */
export function submitErrorMessage(failure: SubmitFailure, t: Dictionary): string {
  switch (failure.error) {
    case 'no_attendees':
      return t.errors.noAttendees;
    case 'capacity':
      return interpolate(t.errors.capacity, { remaining: failure.remaining });
    case 'payment_declined':
      // The reason comes from the bank and cannot be translated.
      return interpolate(t.errors.paymentDeclined, { message: failure.message });
    case 'payment_pending':
      return t.pending.message;
    case 'rate_limited':
      return t.errors.rateLimited;
    case 'rate_unavailable':
      return t.errors.rateUnavailable;
    case 'validation':
      return t.errors.invalidData;
  }
}
