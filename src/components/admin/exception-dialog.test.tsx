// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExceptionDialog } from './exception-dialog';

describe('ExceptionDialog', () => {
  it('hides capacity field when "Día cerrado" is selected', async () => {
    render(<ExceptionDialog open onOpenChange={() => {}} onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    expect(screen.getByLabelText(/Capacidad máxima/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Día cerrado/i }));
    expect(screen.queryByLabelText(/Capacidad máxima/i)).toBeNull();
  });

  it('saves closed day as capacity 0', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<ExceptionDialog open onOpenChange={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Fecha/i), '2030-08-15');
    await userEvent.click(screen.getByRole('radio', { name: /Día cerrado/i }));
    await userEvent.type(screen.getByLabelText(/Motivo/i), 'Mantenimiento');
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(onSave).toHaveBeenCalledWith('2030-08-15', 0, 'Mantenimiento');
  });
});
