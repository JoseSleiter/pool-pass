/**
 * Party rules for the landing hero card. They mirror bookingSchema
 * (src/lib/schemas.ts): 0–20 adults, 0–20 children and at least 1 person in
 * total, so the hero and /reservar always agree on what is valid.
 */
export const PARTY_MIN = 1;
export const GROUP_MAX = 20;

/** One more person fits in the group (adults or children) being increased. */
export function canAddGuest(groupCount: number): boolean {
  return groupCount < GROUP_MAX;
}

/** `groupCount` is the group being decreased (adults or children). */
export function canRemoveGuest(groupCount: number, adults: number, children: number): boolean {
  return groupCount > 0 && adults + children > PARTY_MIN;
}
