/**
 * Admin allowlist. A logged-in Supabase user is NOT automatically an admin;
 * their email must appear in the ADMIN_EMAILS env var (comma-separated).
 * Fails closed: an empty/unset list grants no one admin access.
 */
export function adminEmails(): string[] {
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
