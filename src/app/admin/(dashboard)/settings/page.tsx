import { adminGetSettings } from '../../actions';
import { requireAdmin } from '@/lib/auth/require-admin';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  // Settings are owner-only; show a notice instead of an error page to operators.
  const me = await requireAdmin();
  if (me.role !== 'owner') {
    return (
      <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Solo el dueño puede ver y cambiar la configuración.
      </p>
    );
  }
  const { settings, overrides } = await adminGetSettings();
  return <SettingsForm settings={settings} overrides={overrides} />;
}
