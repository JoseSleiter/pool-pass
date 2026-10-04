import type { SettingsRow, OverrideRow } from '@/lib/db/reservations';
import type { AdminAccessEntry } from '@/app/admin/actions';
import { SettingsTabs } from './settings/settings-tabs';
import { GeneralPanel } from './settings/general-panel';
import { ExceptionsPanel } from './settings/exceptions-panel';
import { RolesPanel } from './settings/roles-panel';
import type { SettingsTab } from './settings/tab-param';

/** Owner-only settings page body: header + General / Excepciones / Accesos tabs. */
export function SettingsForm(props: {
  settings: SettingsRow;
  overrides: OverrideRow[];
  roles: AdminAccessEntry[];
  currentEmail: string;
  initialTab: SettingsTab;
  /** Today in America/Caracas (YYYY-MM-DD). */
  today: string;
  /** Server render time (ms) so the BCV age matches between SSR and hydration. */
  now: number;
}) {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra la capacidad, los precios, las excepciones y los accesos del complejo.
        </p>
      </div>
      <SettingsTabs
        initialTab={props.initialTab}
        panels={{
          general: <GeneralPanel settings={props.settings} now={props.now} />,
          excepciones: <ExceptionsPanel overrides={props.overrides} today={props.today} />,
          accesos: <RolesPanel entries={props.roles} currentEmail={props.currentEmail} />,
        }}
      />
    </main>
  );
}
