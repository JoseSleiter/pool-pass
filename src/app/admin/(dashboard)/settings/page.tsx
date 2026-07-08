import { adminGetSettings } from '../../actions';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const { settings, overrides } = await adminGetSettings();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Configuración</h1>
      <SettingsForm settings={settings} overrides={overrides} />
    </main>
  );
}
