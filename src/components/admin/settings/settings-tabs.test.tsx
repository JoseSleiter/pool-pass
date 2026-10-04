// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsTabs } from './settings-tabs';

const panels = {
  general: <p>Panel general</p>,
  excepciones: <p>Panel excepciones</p>,
  accesos: <p>Panel accesos</p>,
};

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/settings');
});

describe('SettingsTabs', () => {
  it('renders a labelled tablist and selects the initial tab', () => {
    render(<SettingsTabs initialTab="excepciones" panels={panels} />);
    expect(screen.getByRole('tablist', { name: 'Secciones de configuración' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'false');
    // hidden panels are excluded from role queries
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel excepciones');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'settings-tab-excepciones');
  });

  it('uses a roving tabindex (only the selected tab is tabbable)', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('tabindex', '-1');
  });

  it('clicking a tab selects it and writes ?tab= to the URL', async () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Accesos' }));
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.pathname).toBe('/admin/settings');
    expect(window.location.search).toBe('?tab=accesos');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel accesos');
  });

  it('arrow keys (wrapping), Home and End move selection and focus', async () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    screen.getByRole('tab', { name: 'General' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Excepciones' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Accesos' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'General' })).toHaveFocus();
    expect(window.location.search).toBe('?tab=general');
  });

  it('keeps inactive panels mounted but hidden (unsaved edits survive a tab switch)', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByText('Panel accesos')).not.toBeVisible();
    expect(screen.getByText('Panel general')).toBeVisible();
  });

  it('tabs are 44px touch targets', () => {
    render(<SettingsTabs initialTab="general" panels={panels} />);
    expect(screen.getByRole('tab', { name: 'General' }).className).toContain('min-h-11');
  });
});
