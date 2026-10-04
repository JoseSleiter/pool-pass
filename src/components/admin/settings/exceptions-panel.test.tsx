// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/actions', () => ({
  adminUpsertOverride: vi.fn().mockResolvedValue({ ok: true }),
  adminDeleteOverride: vi.fn().mockResolvedValue({ ok: true }),
}));

import { ExceptionsPanel } from './exceptions-panel';
import { adminUpsertOverride, adminDeleteOverride } from '@/app/admin/actions';
import type { OverrideRow } from '@/lib/db/reservations';

const overrides: OverrideRow[] = [
  { date: '2030-08-15', capacity: 0, reason: 'Mantenimiento' },
  { date: '2030-08-20', capacity: 40, reason: 'Boda de la familia Pérez' },
];

beforeEach(() => vi.clearAllMocks());

describe('ExceptionsPanel', () => {
  it('opens on the month of today and highlights overrides', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    expect(screen.getByRole('heading', { name: 'agosto de 2030' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /15 de agosto: cerrado/ })).toHaveAttribute('data-kind', 'closed');
  });

  it('lists overrides with reason chips (preset color vs. free text = Otro)', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    expect(screen.getByText('Complejo cerrado')).toBeInTheDocument();
    expect(screen.getByText('Capacidad limitada a 40 personas')).toBeInTheDocument();
    expect(screen.getByText('Mantenimiento').className).toContain('bg-amber-100');
    expect(screen.getByText('Boda de la familia Pérez').className).toContain('bg-slate-100');
  });

  it('formats list dates with first-letter:uppercase, never capitalize', () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    const date = screen.getByText(/15 ago/);
    expect(date.className).toContain('first-letter:uppercase');
    expect(date.className).not.toMatch(/\bcapitalize\b/);
  });

  it('clicking a free day opens "Nueva excepción" for that date and saves it', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getByRole('button', { name: /10 de agosto/ }));
    expect(screen.getByRole('dialog', { name: 'Nueva excepción' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-10');
    await userEvent.click(screen.getByRole('button', { name: 'Feriado' }));
    await userEvent.click(screen.getByRole('button', { name: /Guardar excepción/i }));
    expect(adminUpsertOverride).toHaveBeenCalledWith('2030-08-10', 25, 'Feriado');
    expect(refresh).toHaveBeenCalled();
  });

  it('clicking an overridden day opens "Editar excepción" with its data', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getByRole('button', { name: /15 de agosto/ }));
    expect(screen.getByRole('dialog', { name: 'Editar excepción' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('2030-08-15');
    expect(screen.getByLabelText(/Fecha/i)).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Día cerrado/i })).toBeChecked();
  });

  it('edits from the list too', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Editar excepción' })[1]);
    expect(screen.getByLabelText(/Capacidad máxima/i)).toHaveValue(40);
  });

  it('deletes after confirmation', async () => {
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar excepción' })[0]);
    expect(screen.getByRole('dialog', { name: '¿Eliminar esta excepción?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(adminDeleteOverride).toHaveBeenCalledWith('2030-08-15');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the delete error', async () => {
    vi.mocked(adminDeleteOverride).mockResolvedValueOnce({ ok: false, message: 'No se pudo eliminar.' });
    render(<ExceptionsPanel overrides={overrides} today="2030-08-01" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar excepción' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo eliminar.');
  });

  it('shows the empty state', () => {
    render(<ExceptionsPanel overrides={[]} today="2030-08-01" />);
    expect(screen.getByText(/No tienes excepciones configuradas/)).toBeInTheDocument();
  });

  it('"Nueva excepción" button opens an empty dialog (44px)', async () => {
    render(<ExceptionsPanel overrides={[]} today="2030-08-01" />);
    const btn = screen.getByRole('button', { name: /Nueva excepción/ });
    expect(btn.className).toContain('h-11');
    await userEvent.click(btn);
    expect(screen.getByLabelText(/Fecha/i)).toHaveValue('');
  });
});
