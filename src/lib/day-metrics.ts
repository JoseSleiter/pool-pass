/** Occupancy color bands (roadmap §2): 0–70 % normal, 71–90 % high, 91 %+ peak. */
export type OccupancyLevel = 'normal' | 'high' | 'peak';

export const OCCUPANCY_HIGH_FROM = 71;
export const OCCUPANCY_PEAK_FROM = 91;

/**
 * Whole percent of the day's capacity in use (may exceed 100 when overbooked).
 * null when the day is closed (capacity 0). Bands are decided on this rounded
 * value so the shown number and its color never disagree.
 */
export function occupancyPercent(people: number, capacity: number): number | null {
  if (capacity <= 0) return null;
  return Math.round((people / capacity) * 100);
}

export function occupancyLevel(percent: number): OccupancyLevel {
  if (percent >= OCCUPANCY_PEAK_FROM) return 'peak';
  if (percent >= OCCUPANCY_HIGH_FROM) return 'high';
  return 'normal';
}
