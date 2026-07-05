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
