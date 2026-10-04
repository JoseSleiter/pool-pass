// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';
import { CountRow } from './count-row';
import { renderWithI18n } from '@/test/i18n';

type Props = Parameters<typeof CountRow>[0];

function renderRow(over: Partial<Props> = {}) {
  const onChange = vi.fn();
  renderWithI18n(
    <CountRow label="Adultos" hint="$15 por persona" value={2} onChange={onChange} testId="row" {...over} />
  );
  return onChange;
}

describe('CountRow', () => {
  it('steps by one in both directions', async () => {
    const onChange = renderRow();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar adultos' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Disminuir adultos' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('keeps the default 0–20 bounds per group', () => {
    renderRow({ value: 0 });
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeEnabled();
  });

  it('disables increase at 20 by default', () => {
    renderRow({ value: 20 });
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeDisabled();
  });

  it('honours canIncrease / canDecrease overrides (whole-party limits)', () => {
    renderRow({ value: 5, canIncrease: false, canDecrease: false });
    expect(screen.getByRole('button', { name: 'Aumentar adultos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disminuir adultos' })).toBeDisabled();
  });

  it('renders the optional icon', () => {
    renderRow({ icon: <User data-testid="row-icon" /> });
    expect(screen.getByTestId('row-icon')).toBeInTheDocument();
  });

  it('shows the value under the given test id', () => {
    renderRow({ value: 7 });
    expect(screen.getByTestId('row')).toHaveTextContent('7');
  });
});
