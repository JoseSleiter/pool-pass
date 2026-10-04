import type { Locale } from '@/lib/i18n/types';

/** Current date in Venezuela (YYYY-MM-DD). Anchors "today" to Caracas, not the server's UTC clock. */
export function todayCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

/** HH:MM (24h) in Venezuela time for an ISO timestamp. */
export function caracasTime(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Hour of day (0–23) in Venezuela time for an ISO timestamp. */
export function caracasHour(iso: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'hour');
  return Number(hour?.value ?? 0) % 24;
}

/**
 * Saturday + Sunday (YYYY-MM-DD) of the weekend to advertise, given today's
 * Caracas date. On a Saturday or Sunday it is the current weekend.
 */
export function upcomingWeekend(today: string): { saturday: string; sunday: string } {
  const base = new Date(`${today}T12:00:00Z`);
  const dow = base.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const toSaturday = dow === 0 ? -1 : 6 - dow;
  const shift = (days: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return { saturday: shift(toSaturday), sunday: shift(toSaturday + 1) };
}

/** "mar, 15 ene" — short Spanish date for summary cards. */
export function shortDateEs(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${date}T12:00:00-04:00`));
}

/** "martes, 15 de enero" — long Spanish date for the admin day header. */
export function longDateEs(date: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${date}T12:00:00-04:00`));
}

/** "Vie, 17 Jul 2026" — capitalized, dot-free short label for booking cards. */
export function visitLabelEs(date: string): string {
  const raw = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(`${date}T12:00:00-04:00`));
  // Capitalize the first letter of each space-delimited token. A \b\p{L} regex
  // would misfire on accented weekdays (JS word boundaries are ASCII-based),
  // producing "SÁB"/"MiÉ" instead of "Sáb"/"Mié".
  return raw
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\./g, '');
}

function capitalizeTokens(s: string): string {
  // Same reasoning as visitLabelEs: split on spaces, not \b, so accented
  // weekdays ("sáb", "mié") are capitalized correctly.
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Booking-card date label: "Vie, 17 Jul 2026" (es) / "Fri, Jul 17, 2026" (en). */
export function visitLabel(date: string, locale: Locale): string {
  if (locale === 'es') return visitLabelEs(date);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(`${date}T12:00:00-04:00`));
}

/** Voucher date line: "Mar, 15 Ene" (es) / "Tue, Jan 15" (en). */
export function shortDateLabel(date: string, locale: Locale): string {
  if (locale === 'es') return capitalizeTokens(shortDateEs(date).replace(/\./g, ''));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${date}T12:00:00-04:00`));
}
