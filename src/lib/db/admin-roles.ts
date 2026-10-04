import { serviceClient } from './service-client';

export type AdminRole = 'owner' | 'operator';

export interface AdminRoleRow {
  email: string;
  role: AdminRole;
}

/** Explicit role for an email, or null when there is no row (caller decides the default). */
export async function getAdminRole(email: string): Promise<AdminRole | null> {
  const { data, error } = await serviceClient()
    .from('admin_roles').select('role').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as AdminRole | undefined) ?? null;
}

export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  const { data, error } = await serviceClient()
    .from('admin_roles').select('email, role').order('email');
  if (error) throw new Error(error.message);
  return data as AdminRoleRow[];
}

export async function upsertAdminRole(email: string, role: AdminRole): Promise<void> {
  const { error } = await serviceClient()
    .from('admin_roles').upsert({ email: email.toLowerCase(), role });
  if (error) throw new Error(error.message);
}
