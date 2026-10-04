'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SETTINGS_TABS, settingsTabHref, type SettingsTab } from './tab-param';

/**
 * WAI-ARIA tabs (automatic activation, roving tabindex). The selected tab is
 * mirrored in `?tab=` with the native History API — Next.js keeps its router
 * in sync with it, so the tab survives a refresh without a server round-trip
 * on every switch. Every panel stays mounted (`hidden`) so unsaved edits in
 * one tab are not lost when visiting another.
 */
export function SettingsTabs(props: { initialTab: SettingsTab; panels: Record<SettingsTab, ReactNode> }) {
  const [active, setActive] = useState<SettingsTab>(props.initialTab);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  function select(tab: SettingsTab, focus = false) {
    setActive(tab);
    window.history.replaceState(null, '', settingsTabHref(tab));
    if (focus) tabRefs.current[tab]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = SETTINGS_TABS.findIndex((t) => t.id === active);
    const last = SETTINGS_TABS.length - 1;
    const target =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (target === null) return;
    e.preventDefault();
    select(SETTINGS_TABS[target].id, true);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de configuración"
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
      >
        {SETTINGS_TABS.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={onKeyDown}
              className={cn(
                'min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
                selected ? 'bg-white text-navy shadow-sm' : 'text-slate-600 hover:bg-white/60',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {SETTINGS_TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`settings-panel-${t.id}`}
          aria-labelledby={`settings-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="mt-4 focus-visible:outline-none"
        >
          {props.panels[t.id]}
        </div>
      ))}
    </div>
  );
}
