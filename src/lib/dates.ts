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
