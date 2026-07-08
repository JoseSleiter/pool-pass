/** "2 adultos, 1 niño" — omits zero groups; child-only bookings are valid. */
export function partyLabel(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults} ${adults === 1 ? 'adulto' : 'adultos'}`);
  if (children > 0) parts.push(`${children} ${children === 1 ? 'niño' : 'niños'}`);
  return parts.join(', ');
}

/** Compact admin form: "2A 1N". */
export function partyShort(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults}A`);
  if (children > 0) parts.push(`${children}N`);
  return parts.join(' ');
}
