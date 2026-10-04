import 'server-only';
import { ssrClient } from '@/lib/db/ssr-client';
import { getAdminRole, type AdminRole } from '@/lib/db/admin-roles';
import { isAdminEmail } from './admin';

export type { AdminRole } from '@/lib/db/admin-roles';

/**
 * Backend admin gate. Validates the Supabase auth token server-side and checks
 * the user's email against the ADMIN_EMAILS allowlist ('Unauthorized'
 * otherwise). The role comes from admin_roles; an allowlisted email with no
 * row is 'owner'. With `{ role: 'owner' }` an operator gets 'Forbidden'.
 * A failed role lookup throws (fail closed). Call this in every admin server
 * action AND any server component that reads customer data.
 */
export async function requireAdmin(opts?: { role?: 'owner' }): Promise<{ email: string; role: AdminRole }> {
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) throw new Error('Unauthorized');
  const email = user.email.toLowerCase();
  const role: AdminRole = (await getAdminRole(email)) ?? 'owner';
  if (opts?.role === 'owner' && role !== 'owner') throw new Error('Forbidden');
  return { email, role };
}
