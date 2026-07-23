// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose } from './dialog';

describe('Dialog', () => {
  it('opens on trigger and closes on close button', async () => {
    render(
      <Dialog>
        <DialogTrigger>Abrir</DialogTrigger>
        <DialogPopup>
          <DialogTitle>Título</DialogTitle>
          <DialogClose>Cerrar</DialogClose>
        </DialogPopup>
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Título')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
