// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// One stable router object, like Next's.
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { SearchBox } from './search-box';
import { DEFAULT_STATE } from '../_lib/search-params';

const input = () => screen.getByRole('textbox', { name: 'Buscar reservas' });

beforeEach(() => {
  vi.useFakeTimers();
  router.replace.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SearchBox', () => {
  it('updates the URL once typing pauses, keeping filters and resetting the page', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, statuses: ['confirmed'], page: 3 }} />);
    fireEvent.change(input(), { target: { value: 'an' } });
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.change(input(), { target: { value: 'ana ' } });
    act(() => { vi.advanceTimersByTime(299); });
    expect(router.replace).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/admin/reservations?q=ana&status=confirmed', { scroll: false });
  });

  it('does not navigate when the text already matches the URL', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    fireEvent.change(input(), { target: { value: 'ana ' } });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('the clear button empties the field and removes q from the URL', () => {
    render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(input()).toHaveValue('');
    act(() => { vi.advanceTimersByTime(300); });
    expect(router.replace).toHaveBeenCalledWith('/admin/reservations', { scroll: false });
  });

  it('adopts a q that changes from outside (chip ✕, ⌘K)', () => {
    const { rerender } = render(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    rerender(<SearchBox state={{ ...DEFAULT_STATE, q: 'luis' }} />);
    expect(input()).toHaveValue('luis');
  });

  it('keeps what the user is typing when its own debounced write lands', () => {
    const { rerender } = render(<SearchBox state={DEFAULT_STATE} />);
    fireEvent.change(input(), { target: { value: 'ana' } });
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.change(input(), { target: { value: 'ana p' } });
    rerender(<SearchBox state={{ ...DEFAULT_STATE, q: 'ana' }} />);
    expect(input()).toHaveValue('ana p');
  });

  it('is a 44px field', () => {
    render(<SearchBox state={DEFAULT_STATE} />);
    expect(input()).toHaveClass('h-11');
  });
});
