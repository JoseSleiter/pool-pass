/** Live numbers for today (Caracas) that the landing hero shows. */
export interface TodayCapacity {
  /** Slots still free today. */
  remaining: number;
  /** Today's total capacity: the day's override if any, else the default. */
  capacity: number;
  /** Default daily capacity (settings): what an untouched day has free. */
  dailyCapacity: number;
}

export type TodayState = 'open' | 'low' | 'soldOut';

/** Below this percentage of today's capacity the badge switches to "Últimos cupos". */
export const LOW_AVAILABILITY_PERCENT = 20;

/**
 * Badge state for today. Integer math (remaining·100 < capacity·20) avoids
 * floating-point surprises right at the 20 % boundary.
 */
export function todayState(remaining: number, capacity: number): TodayState {
  if (remaining <= 0 || capacity <= 0) return 'soldOut';
  if (remaining * 100 < capacity * LOW_AVAILABILITY_PERCENT) return 'low';
  return 'open';
}

/**
 * Remaining slots on `date`. monthAvailability() omits days with no bookings
 * and no override, which still have the whole default capacity free.
 */
export function remainingOn(
  date: string,
  availability: Record<string, number>,
  defaultCapacity?: number
): number | undefined {
  return availability[date] ?? defaultCapacity;
}
