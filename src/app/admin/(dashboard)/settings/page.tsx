import { adminGetSettings } from '../../actions';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const { settings, overrides } = await adminGetSettings();
  return <SettingsForm settings={settings} overrides={overrides} />;
}
