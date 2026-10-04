// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlideOver } from './slide-over';

describe('SlideOver', () => {
  it('is a named modal dialog with body and footer', () => {
    render(
      <SlideOver open onOpenChange={vi.fn()} title="Detalle" footer={<button type="button">Acción</button>}>
        <p>cuerpo</p>
      </SlideOver>,
    );
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toBeInTheDocument();
    expect(screen.getByText('cuerpo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
  });

  it('closes from a 44px close button', async () => {
    const onOpenChange = vi.fn();
    render(<SlideOver open onOpenChange={onOpenChange} title="Detalle"><p>cuerpo</p></SlideOver>);
    const close = screen.getByRole('button', { name: 'Cerrar panel' });
    expect(close).toHaveClass('size-11');
    await userEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing while closed', () => {
    render(<SlideOver open={false} onOpenChange={vi.fn()} title="Detalle"><p>cuerpo</p></SlideOver>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
