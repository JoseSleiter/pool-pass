import { describe, it, expect } from 'vitest';
import { REASON_PRESETS, reasonKind } from './reason-presets';

describe('reasonKind', () => {
  it('lists the quick presets in order', () => {
    expect(REASON_PRESETS).toEqual(['Mantenimiento', 'Evento privado', 'Feriado']);
  });

  it('matches presets case-insensitively and ignoring outer spaces', () => {
    expect(reasonKind('Mantenimiento')).toBe('Mantenimiento');
    expect(reasonKind('  feriado ')).toBe('Feriado');
    expect(reasonKind('EVENTO PRIVADO')).toBe('Evento privado');
  });

  it('classifies any other free text as Otro', () => {
    expect(reasonKind('Mantenimiento de piscina')).toBe('Otro');
    expect(reasonKind('Boda')).toBe('Otro');
  });

  it('returns null when there is no reason', () => {
    expect(reasonKind(null)).toBeNull();
    expect(reasonKind(undefined)).toBeNull();
    expect(reasonKind('   ')).toBeNull();
  });
});
