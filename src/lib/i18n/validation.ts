import type { Dictionary } from './types';

export type ValidationKey = keyof Dictionary['validation'];

/** Minimal shape of a zod issue: we only need the field and the issue code. */
export interface IssueLike {
  path: readonly PropertyKey[];
  code: string;
}

/**
 * Maps a paymentSchema issue to a dictionary key. The schema keeps its Spanish
 * messages (the server and the email use it); the client shows the translated
 * text for the same failure instead.
 */
export function validationKey(issue: IssueLike): ValidationKey {
  switch (String(issue.path[0])) {
    case 'date':
      return 'invalidDate';
    case 'firstName':
    case 'lastName':
      return issue.code === 'too_big' ? 'tooLong' : 'required';
    case 'email':
      return 'invalidEmail';
    case 'idType':
      return 'invalidIdType';
    case 'idNumber':
      return 'idDigits';
    case 'phone':
      return 'invalidPhone';
    case 'bankCode':
      return 'bankRequired';
    case 'otp':
      return issue.code === 'too_big' ? 'tooLong' : 'pinRequired';
    case 'adults':
      return issue.code === 'custom' ? 'noAttendees' : 'invalid';
    default:
      return 'invalid';
  }
}
