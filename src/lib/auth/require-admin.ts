import 'server-only';
import { ssrClient } from '@/lib/db/ssr-client';
import { isAdminEmail } from './admin';

/**
 * Backend admin gate. Validates the Supabase auth token server-side and checks
 * the user's email against the ADMIN_EMAILS allowlist. Throws 'Unauthorized'
 * otherwise. Call this in every admin server action AND any server component
 * that reads customer data — never rely on middleware alone.
 */
export async function requireAdmin(): Promise<void> {
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) throw new Error('Unauthorized');
}
