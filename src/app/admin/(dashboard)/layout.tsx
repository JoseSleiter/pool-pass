// src/app/admin/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { loadShellStatus } from '@/components/admin/topbar-data';

function isAuthError(e: unknown): boolean {
  return e instanceof Error && (e.message === 'Unauthorized' || e.message === 'Forbidden');
}

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects non-allowlisted users; this is the server-side
  // gate and the source of the role the shell shows. Other errors (e.g. the
  // role lookup failing) are rethrown: fail closed.
  const user = await requireAdmin().catch((e: unknown) => {
    if (isAuthError(e)) return null;
    throw e;
  });
  if (!user) redirect('/admin/login');

  const status = await loadShellStatus();
  return <AdminShell user={user} status={status}>{children}</AdminShell>;
}
