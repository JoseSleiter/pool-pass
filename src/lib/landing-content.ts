import type { Dictionary } from '@/lib/i18n/types';

type StepId = keyof Dictionary['content']['steps'];
type AmenityId = keyof Dictionary['content']['amenities'];

/**
 * Non-translatable landing data. Every visible sentence (tagline, subtitle,
 * step and amenity texts, opening hours) lives in the i18n dictionaries; steps
 * and amenities carry an `id` that points into `t.content.steps` /
 * `t.content.amenities`.
 */
const steps: readonly { icon: string; id: StepId }[] = [
  { icon: '📅', id: 'chooseDate' },
  { icon: '📲', id: 'payC2p' },
  { icon: '✉️', id: 'getQr' },
  { icon: '🏊', id: 'walkIn' },
];

const amenities: readonly { icon: string; id: AmenityId }[] = [
  { icon: '🏊', id: 'pool' },
  { icon: '🛡️', id: 'lifeguards' },
  { icon: '🍔', id: 'food' },
  { icon: '🅿️', id: 'parking' },
  { icon: '🪑', id: 'shade' },
  { icon: '🚿', id: 'showers' },
];

export const landingContent = {
  clubName: 'Complejo Turístico Villa Victoria',
  steps,
  amenities,
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
