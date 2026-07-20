import { describe, it, expect } from 'vitest';
import { landingContent, whatsappUrl } from './landing-content';

describe('landing content', () => {
  it('has six amenities and four steps', () => {
    expect(landingContent.amenities).toHaveLength(6);
    expect(landingContent.steps).toHaveLength(4);
  });
  it('builds a digits-only wa.me link', () => {
    expect(whatsappUrl()).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });
});
