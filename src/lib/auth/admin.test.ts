import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail, adminEmails } from './admin';

const ORIGINAL = process.env.ADMIN_EMAILS;

describe('isAdminEmail', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'owner@club.com, Manager@Club.com';
  });
  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it('allows an email on the list', () => {
    expect(isAdminEmail('owner@club.com')).toBe(true);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(isAdminEmail('MANAGER@club.com')).toBe(true);
  });

  it('rejects an email not on the list', () => {
    expect(isAdminEmail('intruder@evil.com')).toBe(false);
  });

  it('rejects null / undefined / empty', () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });

  it('rejects everyone when ADMIN_EMAILS is unset (fail closed)', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('owner@club.com')).toBe(false);
  });
});

describe('adminEmails', () => {
  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL;
  });

  it('returns the allowlist trimmed, lowercased and deduplicated, in order', () => {
    process.env.ADMIN_EMAILS = ' Owner@Club.com, ops@club.com ,OWNER@club.com,, ';
    expect(adminEmails()).toEqual(['owner@club.com', 'ops@club.com']);
  });

  it('returns [] when ADMIN_EMAILS is unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(adminEmails()).toEqual([]);
  });
});
