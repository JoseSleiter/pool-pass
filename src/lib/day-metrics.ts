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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** true for a real calendar date written as YYYY-MM-DD (rejects 2030-02-31). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD moved by `days` whole days (UTC math: no DST or timezone drift). */
export function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The admin home's `?date=` param, or `today` when it is missing or not a real date. */
export function parseDayParam(raw: unknown, today: string): string {
  return typeof raw === 'string' && isIsoDate(raw) ? raw : today;
}

/** People checked in during one Caracas hour (0–23). Same shape as DaySummary.checkinsByHour. */
export interface HourBucket {
  hour: number;
  people: number;
}

/**
 * Contiguous hours from the first to the last hour with check-ins, with empty
 * hours as 0, ready for a bar sparkline. Empty input → empty output.
 */
export function hourlySeries(byHour: HourBucket[]): HourBucket[] {
  if (byHour.length === 0) return [];
  const people = new Map(byHour.map((b) => [b.hour, b.people]));
  const hours = byHour.map((b) => b.hour);
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  const series: HourBucket[] = [];
  for (let hour = first; hour <= last; hour++) series.push({ hour, people: people.get(hour) ?? 0 });
  return series;
}

/** "09:00" — label for a Caracas hour bucket. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
