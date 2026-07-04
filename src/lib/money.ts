export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalUsd(
  adults: number,
  children: number,
  prices: { adult: number; child: number }
): number {
  return roundMoney(adults * prices.adult + children * prices.child);
}

export function usdToVes(usd: number, rate: number): number {
  return roundMoney(usd * rate);
}
