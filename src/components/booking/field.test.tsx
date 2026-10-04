// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from './field';

describe('Field', () => {
  it('labels the input and reports typed values', async () => {
    const onChange = vi.fn();
    render(<Field label="Nombre" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Nombre'), 'A');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('links the hint to the input through aria-describedby', () => {
    render(<Field label="Teléfono" value="" onChange={() => {}} hint="Operadoras: 0412" />);
    expect(screen.getByLabelText('Teléfono')).toHaveAccessibleDescription('Operadoras: 0412');
  });

  it('shows the error instead of the hint and marks the input invalid', () => {
    render(<Field label="Teléfono" value="" onChange={() => {}} hint="Operadoras: 0412" error="Teléfono inválido" />);
    const input = screen.getByLabelText('Teléfono');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Teléfono inválido');
    expect(screen.queryByText('Operadoras: 0412')).not.toBeInTheDocument();
  });
});
