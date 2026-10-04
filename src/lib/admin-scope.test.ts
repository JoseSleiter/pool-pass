// src/lib/admin-scope.test.ts
import { describe, it, expect } from 'vitest';
import { ADMIN_SCOPE, ADMIN_SCOPE_HEADER, documentLocale } from './admin-scope';

describe('documentLocale', () => {
  it('forces Spanish in the admin scope whatever the cookie says', () => {
    expect(documentLocale('en', ADMIN_SCOPE)).toBe('es');
    expect(documentLocale('es', ADMIN_SCOPE)).toBe('es');
  });

  it('keeps the cookie locale everywhere else', () => {
    expect(documentLocale('en', null)).toBe('en');
    expect(documentLocale('es', null)).toBe('es');
    expect(documentLocale('en', 'something-else')).toBe('en');
  });

  it('uses a lowercase request header name', () => {
    expect(ADMIN_SCOPE_HEADER).toBe('x-pp-scope');
  });
});
