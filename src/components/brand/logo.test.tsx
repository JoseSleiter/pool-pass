// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo } from './logo';

describe('Logo', () => {
  it('names the club in its alt text', () => {
    render(<Logo />);
    expect(screen.getByAltText('Complejo Turístico Villa Victoria')).toBeInTheDocument();
  });

  it('wraps the mark in a white chip when asked', () => {
    const { container } = render(<Logo variant="chip" />);
    expect(container.firstElementChild).toHaveClass('bg-white');
  });

  // The caller's className lands on the img, not on the chip — which is why
  // booking-card.tsx has to wrap the chip in its own div to place it.
  it('puts the caller className on the img, with the chip as an outer span', () => {
    const plain = render(<Logo className="h-9 w-auto" />).container;
    expect(plain.firstElementChild?.tagName).toBe('IMG');
    expect(plain.firstElementChild).toHaveClass('h-9');

    const chip = render(<Logo variant="chip" className="h-9 w-auto" />).container;
    const root = chip.firstElementChild;
    expect(root?.tagName).toBe('SPAN');
    expect(root).not.toHaveClass('h-9');
    const img = root?.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveClass('h-9');
  });
});
