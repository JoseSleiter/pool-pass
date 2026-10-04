// src/components/admin/admin-nav-links.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminNavLinks } from './admin-nav-links';
import { visibleNavGroups } from './nav-config';

describe('AdminNavLinks', () => {
  it('renders group labels and marks the active route', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin/settings" />);
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByText('Gestión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute('aria-current');
  });

  it('keeps accessible names when collapsed but hides labels visually', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin" collapsed />);
    const link = screen.getByRole('link', { name: 'Hoy' });
    expect(link).toHaveAttribute('title', 'Hoy');
    expect(screen.getByText('Hoy')).toHaveClass('sr-only');
    expect(screen.getByText('Operaciones')).toHaveClass('sr-only');
  });

  it('lays out every link as a 44px touch target', () => {
    render(<AdminNavLinks groups={visibleNavGroups('owner')} pathname="/admin" />);
    expect(screen.getByRole('link', { name: 'Hoy' })).toHaveClass('min-h-11');
  });
});
