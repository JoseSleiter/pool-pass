// src/lib/audit-labels.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { AuditAction } from '@/lib/audit';
import {
  AUDIT_ACTIONS, AUDIT_ACTION_LABELS, auditActionLabel, auditLinkParams, auditQuerySchema,
  formatAuditDetails, isAuditAction, parseAuditParams,
} from './audit-labels';

describe('AUDIT_ACTION_LABELS', () => {
  it('has exactly one key per AuditAction (type level, checked by tsc)', () => {
    expectTypeOf<keyof typeof AUDIT_ACTION_LABELS>().toEqualTypeOf<AuditAction>();
    expectTypeOf(AUDIT_ACTIONS).toEqualTypeOf<AuditAction[]>();
  });

  it('covers every action of the roadmap §3.2 contract', () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual([
      'override.delete', 'override.upsert', 'reservation.check_in',
      'reservation.resend_voucher', 'role.upsert', 'settings.update',
    ]);
  });

  it('uses distinct, human Spanish labels (never the raw key)', () => {
    const labels = AUDIT_ACTIONS.map((a) => AUDIT_ACTION_LABELS[a]);
    expect(new Set(labels).size).toBe(labels.length);
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label.trim()).not.toBe('');
      expect(label).not.toBe(action);
      expect(label).not.toContain('.');
    }
    expect(auditActionLabel('reservation.check_in')).toBe('Check-in registrado');
    expect(auditActionLabel('settings.update')).toBe('Configuración actualizada');
  });

  it('shows unknown actions raw', () => {
    expect(auditActionLabel('legacy.thing')).toBe('legacy.thing');
    expect(isAuditAction('legacy.thing')).toBe(false);
    expect(isAuditAction('toString')).toBe(false);
    expect(isAuditAction('role.upsert')).toBe(true);
  });
});

describe('formatAuditDetails', () => {
  it('renders key: value pairs joined by a middle dot', () => {
    expect(formatAuditDetails({ daily_capacity: 80, adult_price_usd: 15 }))
      .toBe('daily_capacity: 80 · adult_price_usd: 15');
  });

  it('shows null/empty values as a dash and nested values as JSON', () => {
    expect(formatAuditDetails({ capacity: 0, reason: null })).toBe('capacity: 0 · reason: —');
    expect(formatAuditDetails({ note: '' })).toBe('note: —');
    expect(formatAuditDetails({ nested: { a: 1 }, flag: true })).toBe('nested: {"a":1} · flag: true');
  });

  it('is a dash when there are no details', () => {
    expect(formatAuditDetails({})).toBe('—');
    expect(formatAuditDetails(null)).toBe('—');
  });
});

describe('parseAuditParams / auditLinkParams / auditQuerySchema', () => {
  it('parses a known action and paging', () => {
    expect(parseAuditParams({ action: 'role.upsert', page: '2', pageSize: '25' }))
      .toEqual({ action: 'role.upsert', page: 2, pageSize: 25 });
  });

  it('drops unknown or empty actions', () => {
    expect(parseAuditParams({ action: 'evil' })).toEqual({ page: 1, pageSize: 10 });
    expect(parseAuditParams({ action: '' })).toEqual({ page: 1, pageSize: 10 });
  });

  it('carries only the action into pagination links', () => {
    expect(auditLinkParams({ action: 'override.delete', page: 3, pageSize: 10 })).toEqual({ action: 'override.delete' });
    expect(auditLinkParams({ page: 1, pageSize: 10 })).toEqual({});
  });

  it('validates action input strictly', () => {
    expect(auditQuerySchema.safeParse({ page: 1, pageSize: 10 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ action: 'role.upsert', page: 1, pageSize: 10 }).success).toBe(true);
    expect(auditQuerySchema.safeParse({ action: 'evil', page: 1, pageSize: 10 }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ page: 1, pageSize: 99 }).success).toBe(false);
  });
});
