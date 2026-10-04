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
  it('amenity photos, when set, live in public/amenities and are named after the amenity', () => {
    for (const a of landingContent.amenities) {
      if (a.image !== undefined) expect(a.image).toBe(`/amenities/${a.id}.webp`);
    }
  });
  it('every pool rule id has text in both dictionaries', () => {
    // `amenities.rules` is `{}` until the owner adds rules; widen it to index by id.
    const esRules = es.amenities.rules as Record<string, string>;
    const enRules = en.amenities.rules as Record<string, string>;
    for (const id of landingContent.rules) {
      expect(esRules[id], id).toBeTruthy();
      expect(enRules[id], id).toBeTruthy();
    }
  });
  it('has the amenities section copy in both languages', () => {
    for (const key of ['heading', 'body', 'scheduleHeading', 'rulesHeading'] as const) {
      expect(es.amenities[key], key).toBeTruthy();
      expect(en.amenities[key], key).toBeTruthy();
    }
  });
  it('builds the club wa.me link', () => {
    expect(whatsappUrl()).toBe('https://wa.me/584249196984');
  });
  it('builds the club instagram link', () => {
    expect(instagramUrl()).toBe('https://instagram.com/finca_villa_victoria');
  });
});
