import { describe, it, expect } from 'vitest';
import { interpolate, formatParty } from './format';
import { es } from './es';
import { en } from './en';
import { partyLabel } from '@/lib/party';

describe('interpolate', () => {
  it('fills {placeholders} with strings and numbers', () => {
    expect(interpolate('Quedan {n} de {total}', { n: 3, total: '10' })).toBe('Quedan 3 de 10');
  });
  it('fills the same placeholder twice', () => {
    expect(interpolate('{a}-{a}', { a: 'x' })).toBe('x-x');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(interpolate('Hola {name}', {})).toBe('Hola {name}');
  });
});

describe('formatParty', () => {
  it('matches the legacy Spanish partyLabel exactly', () => {
    for (const [a, c] of [[2, 1], [1, 2], [1, 1], [0, 3], [2, 0], [0, 0]]) {
      expect(formatParty(es.party, a, c)).toBe(partyLabel(a, c));
    }
  });
  it('formats English with singular and plural forms', () => {
    expect(formatParty(en.party, 2, 1)).toBe('2 adults, 1 child');
    expect(formatParty(en.party, 1, 2)).toBe('1 adult, 2 children');
    expect(formatParty(en.party, 0, 3)).toBe('3 children');
    expect(formatParty(en.party, 0, 0)).toBe('');
  });
});
