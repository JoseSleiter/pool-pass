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

  it('renders no chip by default', () => {
    const { container } = render(<Logo />);
    expect(container.firstElementChild).not.toHaveClass('bg-white');
  });
});
