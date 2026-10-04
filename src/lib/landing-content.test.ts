import { describe, it, expect } from 'vitest';
import { landingContent, whatsappUrl, instagramUrl } from './landing-content';
import { es } from '@/lib/i18n/es';
import { en } from '@/lib/i18n/en';

describe('landing content', () => {
  it('has six amenities and four steps', () => {
    expect(landingContent.amenities).toHaveLength(6);
    expect(landingContent.steps).toHaveLength(4);
  });
  it('every step and amenity id has text in both dictionaries', () => {
    for (const s of landingContent.steps) {
      expect(es.content.steps[s.id]).toBeTruthy();
      expect(en.content.steps[s.id]).toBeTruthy();
    }
    for (const a of landingContent.amenities) {
      expect(es.content.amenities[a.id]).toBeTruthy();
      expect(en.content.amenities[a.id]).toBeTruthy();
    }
  });
  it('builds the club wa.me link', () => {
    expect(whatsappUrl()).toBe('https://wa.me/584249196984');
  });
  it('builds the club instagram link', () => {
    expect(instagramUrl()).toBe('https://instagram.com/finca_villa_victoria');
  });
});
