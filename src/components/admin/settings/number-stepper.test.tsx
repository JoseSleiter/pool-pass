// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  NumberStepper, stepValue, stepperKeyValue, parseStepperValue, type StepperBounds,
} from './number-stepper';

const CAP: StepperBounds = { min: 0, max: 10000, step: 1, decimals: 0 };
const PRICE: StepperBounds = { min: 0, max: 1000, step: 0.5, decimals: 2 };

describe('parseStepperValue', () => {
  it('parses numbers, accepts a decimal comma, rejects empty/garbage', () => {
    expect(parseStepperValue('7.5')).toBe(7.5);
    expect(parseStepperValue('7,5')).toBe(7.5);
    expect(parseStepperValue('')).toBeNull();
    expect(parseStepperValue('  ')).toBeNull();
    expect(parseStepperValue('abc')).toBeNull();
  });
});

describe('stepValue', () => {
  it('adds the delta', () => {
    expect(stepValue('100', 1, CAP)).toBe('101');
    expect(stepValue('7', 0.5, PRICE)).toBe('7.5');
    expect(stepValue('7.5', -0.5, PRICE)).toBe('7');
  });

  it('clamps to the bounds', () => {
    expect(stepValue('0', -1, CAP)).toBe('0');
    expect(stepValue('10000', 1, CAP)).toBe('10000');
    expect(stepValue('999.8', 0.5, PRICE)).toBe('1000');
  });

  it('steps from min when the field is empty or invalid', () => {
    expect(stepValue('', 1, CAP)).toBe('1');
    expect(stepValue('abc', -1, CAP)).toBe('0');
  });

  it('rounds away floating point noise', () => {
    expect(stepValue('0.1', 0.2, PRICE)).toBe('0.3');
    expect(stepValue('7,5', 0.5, PRICE)).toBe('8');
  });
});

describe('stepperKeyValue', () => {
  it('maps spinbutton keys', () => {
    expect(stepperKeyValue('ArrowUp', '100', CAP)).toBe('101');
    expect(stepperKeyValue('ArrowDown', '100', CAP)).toBe('99');
    expect(stepperKeyValue('PageUp', '100', CAP)).toBe('110');
    expect(stepperKeyValue('PageDown', '100', CAP)).toBe('90');
    expect(stepperKeyValue('Home', '100', CAP)).toBe('0');
    expect(stepperKeyValue('End', '100', CAP)).toBe('10000');
    expect(stepperKeyValue('a', '100', CAP)).toBeNull();
  });
});

function Harness(props: { initial: string; bounds?: StepperBounds }) {
  const [value, setValue] = useState(props.initial);
  return (
    <NumberStepper id="cap" label="Capacidad diaria" value={value} onChange={setValue}
      bounds={props.bounds ?? CAP} hint="Personas por día" />
  );
}

describe('NumberStepper', () => {
  it('exposes a labelled spinbutton with its bounds and hint', () => {
    render(<Harness initial="100" />);
    const input = screen.getByRole('spinbutton', { name: 'Capacidad diaria' });
    expect(input).toHaveValue('100');
    expect(input).toHaveAttribute('aria-valuemin', '0');
    expect(input).toHaveAttribute('aria-valuemax', '10000');
    expect(input).toHaveAttribute('aria-valuenow', '100');
    expect(input).toHaveAccessibleDescription('Personas por día');
  });

  it('− and + buttons step the value and are 44px targets', async () => {
    render(<Harness initial="100" />);
    const plus = screen.getByRole('button', { name: 'Aumentar Capacidad diaria' });
    const minus = screen.getByRole('button', { name: 'Disminuir Capacidad diaria' });
    expect(plus.className).toContain('size-11');
    expect(minus.className).toContain('size-11');
    await userEvent.click(plus);
    await userEvent.click(plus);
    expect(screen.getByRole('spinbutton')).toHaveValue('102');
    await userEvent.click(minus);
    expect(screen.getByRole('spinbutton')).toHaveValue('101');
  });

  it('disables − at the minimum and + at the maximum', () => {
    const { unmount } = render(<Harness initial="0" />);
    expect(screen.getByRole('button', { name: 'Disminuir Capacidad diaria' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' })).toBeEnabled();
    unmount();
    render(<Harness initial="10000" />);
    expect(screen.getByRole('button', { name: 'Aumentar Capacidad diaria' })).toBeDisabled();
  });

  it('supports the spinbutton keyboard pattern', async () => {
    render(<Harness initial="100" />);
    const input = screen.getByRole('spinbutton');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('101');
    await userEvent.keyboard('{PageDown}');
    expect(input).toHaveValue('91');
    await userEvent.keyboard('{End}');
    expect(input).toHaveValue('10000');
    await userEvent.keyboard('{Home}');
    expect(input).toHaveValue('0');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveValue('0');
  });

  it('still accepts typed values', async () => {
    render(<Harness initial="7" bounds={PRICE} />);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '12.25');
    expect(input).toHaveValue('12.25');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});
