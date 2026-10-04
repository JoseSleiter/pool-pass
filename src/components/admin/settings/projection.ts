import { roundMoney } from '@/lib/money';

export interface RevenueProjection {
  capacity: number;
  allAdults: number;
  allChildren: number;
  min: number;
  max: number;
}

/**
 * Daily revenue when every one of `capacity` slots is sold. Real revenue
 * depends on the adult/child mix, so we return the two extremes instead of
 * inventing a mix. null when capacity is not an integer ≥ 0 or a price is not
 * a finite number ≥ 0.
 */
export function projectRevenue(
  capacity: number,
  adultPrice: number,
  childPrice: number,
): RevenueProjection | null {
  const pricesOk = [adultPrice, childPrice].every((p) => Number.isFinite(p) && p >= 0);
  if (!Number.isInteger(capacity) || capacity < 0 || !pricesOk) return null;
  const allAdults = roundMoney(capacity * adultPrice);
  const allChildren = roundMoney(capacity * childPrice);
  return {
    capacity,
    allAdults,
    allChildren,
    min: Math.min(allAdults, allChildren),
    max: Math.max(allAdults, allChildren),
  };
}
