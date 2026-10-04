import { describe, it, expect } from 'vitest';
import { SETTINGS_TABS, parseSettingsTab, settingsTabHref } from './tab-param';

describe('parseSettingsTab', () => {
  it('accepts the three known tabs', () => {
    expect(parseSettingsTab('general')).toBe('general');
    expect(parseSettingsTab('excepciones')).toBe('excepciones');
    expect(parseSettingsTab('accesos')).toBe('accesos');
  });

  it('falls back to general for missing or unknown values', () => {
    expect(parseSettingsTab(undefined)).toBe('general');
    expect(parseSettingsTab('')).toBe('general');
    expect(parseSettingsTab('logs')).toBe('general');
    expect(parseSettingsTab('ACCESOS')).toBe('general');
  });

  it('uses the first value of a repeated param', () => {
    expect(parseSettingsTab(['accesos', 'general'])).toBe('accesos');
  });
});

describe('settingsTabHref', () => {
  it('builds the settings URL with the tab param', () => {
    expect(settingsTabHref('excepciones')).toBe('/admin/settings?tab=excepciones');
    expect(settingsTabHref('general')).toBe('/admin/settings?tab=general');
  });
});

it('lists tabs in display order with Spanish labels', () => {
  expect(SETTINGS_TABS.map((t) => t.label)).toEqual(['General', 'Excepciones', 'Accesos']);
});
