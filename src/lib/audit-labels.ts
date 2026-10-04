// src/lib/audit-labels.ts
import { z } from 'zod';
import type { AuditAction } from '@/lib/audit';
import {
  firstParam, pageFields, parsePageParams, type AdminPageSize, type RawSearchParams,
} from '@/lib/admin-page-params';

/**
 * Human Spanish label for every AuditAction. `satisfies Record<AuditAction, …>`
 * makes the build fail when an action is added to src/lib/audit.ts without a
 * label here (or a label is left for an action that no longer exists).
 */
export const AUDIT_ACTION_LABELS = {
  'reservation.check_in': 'Check-in registrado',
  'reservation.resend_voucher': 'Voucher reenviado',
  'settings.update': 'Configuración actualizada',
  'override.upsert': 'Excepción de capacidad guardada',
  'override.delete': 'Excepción de capacidad eliminada',
  'role.upsert': 'Rol de acceso asignado',
  'bcv.refresh': 'Tasa BCV actualizada manualmente',
} as const satisfies Record<AuditAction, string>;

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

export function isAuditAction(v: unknown): v is AuditAction {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(AUDIT_ACTION_LABELS, v);
}

/** Known actions get their label; anything else (old or foreign rows) is shown raw. */
export function auditActionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

function detailValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** "daily_capacity: 80 · reason: —"; "—" when there is nothing to show. */
export function formatAuditDetails(details: Record<string, unknown> | null | undefined): string {
  const entries = Object.entries(details ?? {});
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k}: ${detailValue(v)}`).join(' · ');
}

export interface AuditQuery {
  action?: AuditAction;
  page: number;
  pageSize: AdminPageSize;
}

export const auditQuerySchema = z.object({
  action: z.custom<AuditAction>((v) => isAuditAction(v)).optional(),
  ...pageFields,
});

export function parseAuditParams(sp: RawSearchParams): AuditQuery {
  const { page, pageSize } = parsePageParams(sp);
  const action = firstParam(sp.action);
  return { ...(isAuditAction(action) ? { action } : {}), page, pageSize };
}

export function auditLinkParams(q: AuditQuery): Record<string, string> {
  return q.action ? { action: q.action } : {};
}
