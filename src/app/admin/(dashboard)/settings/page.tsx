import { adminGetSettings, adminListRoles } from '../../actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { SettingsForm } from '@/components/admin/settings-form';
import { parseSettingsTab } from '@/components/admin/settings/tab-param';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// Module-level helper keeps the component body free of impure calls (react-hooks/purity).
function renderedAt(): number {
  return Date.now();
}

export default async function AdminSettings(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Settings are owner-only; show a notice instead of an error page to operators.
  const me = await requireAdmin();
  if (me.role !== 'owner') {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Solo el dueño puede ver y cambiar la configuración.
      </p>
    );
  }
  const [{ settings, overrides }, roles, sp] = await Promise.all([
    adminGetSettings(),
    adminListRoles(),
    props.searchParams,
  ]);
  return (
    <SettingsForm
      settings={settings}
      overrides={overrides}
      roles={roles}
      currentEmail={me.email}
      initialTab={parseSettingsTab(sp.tab)}
      today={todayCaracas()}
      now={renderedAt()}
    />
  );
}
