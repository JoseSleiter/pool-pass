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

  it('prefills the date when opened from a calendar day', () => {
    render(<ExceptionDialog open onOpenChange={() => {}} defaultDate="2030-08-10" onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-10');
    expect(screen.getByLabelText(/Fecha/i)).toBeEnabled();
  });

  it('reason chips fill the reason and reflect the pressed state', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<ExceptionDialog open onOpenChange={() => {}} defaultDate="2030-08-10" onSave={onSave} />);
    const feriado = screen.getByRole('button', { name: 'Feriado' });
    expect(feriado).toHaveAttribute('aria-pressed', 'false');
    expect(feriado.className).toContain('min-h-11');
    await userEvent.click(feriado);
    expect(screen.getByLabelText(/Motivo/i)).toHaveValue('Feriado');
    expect(feriado).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(onSave).toHaveBeenCalledWith('2030-08-10', 25, 'Feriado');
  });

  it('"Otro" clears the reason and focuses the free-text field', async () => {
    render(<ExceptionDialog open onOpenChange={() => {}}
      initial={{ date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' }}
      onSave={vi.fn().mockResolvedValue({ ok: true })} />);
    expect(screen.getByRole('button', { name: 'Mantenimiento' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Otro' }));
    const reason = screen.getByLabelText(/Motivo/i);
    expect(reason).toHaveValue('');
    expect(reason).toHaveFocus();
    await userEvent.type(reason, 'Boda');
    expect(screen.getByRole('button', { name: 'Otro' })).toHaveAttribute('aria-pressed', 'true');
  });
});
