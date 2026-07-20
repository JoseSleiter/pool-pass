import { ssrClient } from '@/lib/db/ssr-client';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates these pages; the user is only read for display.
  const supabase = await ssrClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <AdminShell email={user?.email ?? ''}>{children}</AdminShell>;
}
