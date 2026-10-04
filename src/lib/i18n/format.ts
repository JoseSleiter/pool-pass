import type { Dictionary } from './types';

/** Replaces `{name}` tokens with values from `vars`; unknown tokens are kept as-is. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}

/** "2 adultos, 1 niño" / "2 adults, 1 child" — omits zero groups, like partyLabel(). */
export function formatParty(party: Dictionary['party'], adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) {
    parts.push(interpolate(adults === 1 ? party.adultOne : party.adultOther, { count: adults }));
  }
  if (children > 0) {
    parts.push(interpolate(children === 1 ? party.childOne : party.childOther, { count: children }));
  }
  return parts.join(', ');
}
