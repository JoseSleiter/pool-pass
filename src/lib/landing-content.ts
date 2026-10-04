import type { Dictionary } from '@/lib/i18n/types';

type StepId = keyof Dictionary['content']['steps'];
type AmenityId = keyof Dictionary['content']['amenities'];
type RuleId = keyof Dictionary['amenities']['rules'];

export interface Amenity {
  id: AmenityId;
  /**
   * Optional photo served from `public/amenities/<id>.webp`, e.g.
   * `image: '/amenities/pool.webp'`. While unset, the landing shows an
   * aquatic placeholder for the tile.
   */
  image?: string;
}

/**
 * Non-translatable landing data. Every visible sentence (tagline, subtitle,
 * step and amenity texts, opening hours, pool rules) lives in the i18n
 * dictionaries; steps, amenities and rules carry an `id` that points into
 * `t.content.steps` / `t.content.amenities` / `t.amenities.rules`.
 */
const steps: readonly { icon: string; id: StepId }[] = [
  { icon: '📅', id: 'chooseDate' },
  { icon: '📲', id: 'payC2p' },
  { icon: '✉️', id: 'getQr' },
  { icon: '🏊', id: 'walkIn' },
];

/** Order matters: it is the reading order of the bento grid. */
const amenities: readonly Amenity[] = [
  { id: 'pool' },
  { id: 'lifeguards' },
  { id: 'food' },
  { id: 'parking' },
  { id: 'shade' },
  { id: 'showers' },
];

/**
 * Pool rules shown next to the opening hours. Each id needs its text in
 * `es.amenities.rules` and `en.amenities.rules`. The landing hides the rules
 * block while this list is empty.
 */
// TODO(owner): add the club's real pool rules here (never invent them).
const rules: readonly RuleId[] = [];

export const landingContent = {
  clubName: 'Complejo Turístico Villa Victoria',
  steps,
  amenities,
  rules,
  address: 'Tumeremo, Bolívar, Venezuela',
  whatsapp: '+58 424-9196984',
  instagram: 'finca_villa_victoria',
} as const;

export function whatsappUrl(): string {
  return `https://wa.me/${landingContent.whatsapp.replace(/\D/g, '')}`;
}

export function instagramUrl(): string {
  return `https://instagram.com/${landingContent.instagram}`;
}
