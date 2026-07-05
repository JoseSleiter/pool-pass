import Link from 'next/link';
import { adminGetSettings } from '../actions';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  const { settings, overrides } = await adminGetSettings();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Configuración</h1>
        <Link href="/admin" className="text-sm underline">← Reservas</Link>
      </div>
      <SettingsForm settings={settings} overrides={overrides} />
    </main>
  );
}
