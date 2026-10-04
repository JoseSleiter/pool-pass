// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecretField } from './secret-field';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <SecretField
      label="Clave de Pago (C2P)"
      toggleLabel="Mostrar clave"
      value={value}
      onChange={setValue}
      hint="Genera la clave C2P desde la app de tu banco antes de pagar."
    />
  );
}

describe('SecretField', () => {
  it('is masked by default and the toggle reveals and re-masks it, keeping the value', async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/clave de pago/i);
    const toggle = screen.getByRole('button', { name: 'Mostrar clave' });
    await userEvent.type(input, '123456');

    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(input).toHaveValue('123456');

    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('the field label matches only the input, never the toggle', () => {
    render(<Harness />);
    expect(screen.getAllByLabelText(/clave de pago/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Mostrar clave' })).toHaveAttribute(
      'aria-controls',
      screen.getByLabelText(/clave de pago/i).id
    );
  });

  it('describes the input with the hint and keeps a 44px touch target on the toggle', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/clave de pago/i)).toHaveAccessibleDescription(/genera la clave c2p/i);
    expect(screen.getByRole('button', { name: 'Mostrar clave' }).className).toMatch(/\bh-11\b.*\bw-11\b/);
  });
});
