// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepDetails } from './step-details';

const prices = { adult: 15, child: 5 };

function setup() {
  const onNext = vi.fn();
  render(
    <StepDetails
      prices={prices}
      availability={{}}
      initial={{ date: '2030-01-15', adults: 1, children: 0, firstName: '', lastName: '', email: '' }}
      onNext={onNext}
    />
  );
  return { onNext };
}

describe('StepDetails', () => {
  it('shows the live USD total and updates it when steppers change', async () => {
    setup();
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$15.00');
    await userEvent.click(screen.getByRole('button', { name: /aumentar adultos/i }));
    await userEvent.click(screen.getByRole('button', { name: /aumentar niños/i }));
    expect(screen.getByTestId('total-usd')).toHaveTextContent('$35.00');
  });

  it('allows decreasing adults to 0', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByTestId('adults-count')).toHaveTextContent('0');
    await userEvent.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByTestId('adults-count')).toHaveTextContent('0'); // floor is 0
  });

  it('disables Continuar when nobody is attending', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });

  it('allows a child-only party to continue', async () => {
    const { onNext } = setup();
    await userEvent.click(screen.getByRole('button', { name: /disminuir adultos/i }));
    await userEvent.click(screen.getByRole('button', { name: /aumentar niños/i }));
    expect(screen.getByRole('button', { name: /continuar/i })).not.toBeDisabled();
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana');
    await userEvent.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await userEvent.type(screen.getByLabelText(/correo/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ adults: 0, children: 1 }));
  });

  it('blocks continuing when the selected date is sold out', async () => {
    const onNext = vi.fn();
    render(
      <StepDetails
        prices={prices}
        availability={{ '2030-01-15': 0 }}
        initial={{ date: '2030-01-15', adults: 1, children: 0, firstName: '', lastName: '', email: '' }}
        onNext={onNext}
      />
    );
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana');
    await userEvent.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await userEvent.type(screen.getByLabelText(/correo/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha no disponible/i)).toBeInTheDocument();
  });

  it('requires contact fields before continuing', async () => {
    const { onNext } = setup();
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onNext).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ana');
    await userEvent.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await userEvent.type(screen.getByLabelText(/correo/i), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' })
    );
  });
});
