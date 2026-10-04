import { describe, it, expect } from 'vitest';
import { dateFnsLocale } from './date-locale';

describe('dateFnsLocale', () => {
  it('maps es to the date-fns Spanish locale', () => {
    expect(dateFnsLocale('es').code).toBe('es');
  });
  it('maps en to date-fns enUS', () => {
    expect(dateFnsLocale('en').code).toBe('en-US');
  });
});
