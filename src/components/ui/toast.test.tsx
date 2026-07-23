// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from './toast';

describe('Toast', () => {
  it('renders success message with status role', () => {
    render(<Toast kind="success" message="Check-in aprobado" onDismiss={() => {}} />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Check-in aprobado');
  });

  it('renders nothing when message is null', () => {
    const { container } = render(<Toast kind="success" message={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
