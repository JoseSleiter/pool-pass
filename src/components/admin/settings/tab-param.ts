export const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'excepciones', label: 'Excepciones' },
  { id: 'accesos', label: 'Accesos' },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

export const SETTINGS_PATH = '/admin/settings';

const TAB_IDS: readonly string[] = SETTINGS_TABS.map((t) => t.id);

/** `?tab=` value → known tab; anything else is 'general'. */
export function parseSettingsTab(raw: string | string[] | undefined): SettingsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && TAB_IDS.includes(value) ? (value as SettingsTab) : 'general';
}

export function settingsTabHref(tab: SettingsTab): string {
  return `${SETTINGS_PATH}?tab=${tab}`;
}
