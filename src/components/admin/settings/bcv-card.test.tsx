// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/admin/settings-actions', () => ({ adminRefreshBcvRate: vi.fn() }));

import { BcvCard } from './bcv-card';
import { adminRefreshBcvRate } from '@/app/admin/settings-actions';

const NOW = Date.parse('2030-01-15T16:00:00Z');

beforeEach(() => vi.clearAllMocks());

describe('BcvCard', () => {
  it('shows the cached rate, its age and the Caracas time', () => {
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    expect(screen.getByText(/Bs\. 36\.50/)).toBeInTheDocument();
    expect(screen.getByText(/hace 30 minutos/)).toBeInTheDocument();
    expect(screen.getByText(/11:30/)).toBeInTheDocument();
    expect(screen.getByText(/hora de Caracas/)).toBeInTheDocument();
  });

  it('explains when there is no cached rate yet', () => {
    render(<BcvCard rate={null} at={null} now={NOW} />);
    expect(screen.getByText('Aún no hay una tasa guardada.')).toBeInTheDocument();
  });

  it('warns when the cached rate is older than 24 h', () => {
    render(<BcvCard rate={36.5} at="2030-01-13T12:00:00Z" now={NOW} />);
    expect(screen.getByText(/Tiene más de 24 horas/)).toBeInTheDocument();
  });

  it('refreshes on demand and shows the new rate', async () => {
    vi.mocked(adminRefreshBcvRate).mockResolvedValue({ ok: true, rate: 40.12, at: '2030-01-15T16:00:00.000Z' });
    render(<BcvCard rate={36.5} at="2030-01-15T12:00:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(adminRefreshBcvRate).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Tasa actualizada: Bs. 40.12 por USD.')).toBeInTheDocument();
    expect(screen.getByText(/hace menos de 1 minuto/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the action error and keeps the old rate', async () => {
    vi.mocked(adminRefreshBcvRate).mockResolvedValue({
      ok: false, message: 'No se pudo obtener la tasa del BCV. Intenta de nuevo en unos minutos.',
    });
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(await screen.findByText(/No se pudo obtener la tasa del BCV/)).toBeInTheDocument();
    expect(screen.getByText(/Bs\. 36\.50/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('disables the button while refreshing', async () => {
    let resolve!: (v: { ok: true; rate: number; at: string }) => void;
    vi.mocked(adminRefreshBcvRate).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<BcvCard rate={36.5} at="2030-01-15T15:30:00Z" now={NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar tasa ahora' }));
    expect(screen.getByRole('button', { name: 'Actualizando…' })).toBeDisabled();
    resolve({ ok: true, rate: 40, at: '2030-01-15T16:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Actualizar tasa ahora' })).toBeEnabled();
  });
});
