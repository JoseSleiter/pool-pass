import { describe, it, expect } from 'vitest';
import { landingContent, whatsappUrl, instagramUrl } from './landing-content';

describe('landing content', () => {
  it('has six amenities and four steps', () => {
    expect(landingContent.amenities).toHaveLength(6);
    expect(landingContent.steps).toHaveLength(4);
  });
  it('builds the club wa.me link', () => {
    expect(whatsappUrl()).toBe('https://wa.me/584249196984');
  });
  it('builds the club instagram link', () => {
    expect(instagramUrl()).toBe('https://instagram.com/finca_villa_victoria');
  });
});
