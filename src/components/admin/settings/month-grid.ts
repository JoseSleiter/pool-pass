// Calendar math on plain 'YYYY-MM' / 'YYYY-MM-DD' strings in UTC, so the grid
// never shifts with the browser's timezone (dates are Caracas calendar days).

function parts(month: string): { y: number; m: number } {
  return { y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) };
}

/** Monday-first weeks for 'YYYY-MM'; null pads the days outside the month. */
export function monthGrid(month: string): (string | null)[][] {
  const { y, m } = parts(month);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 'YYYY-MM' moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const { y, m } = parts(month);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "septiembre de 2030". */
export function monthLabelEs(month: string): string {
  const { y, m } = parts(month);
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
}

export const WEEKDAYS_ES = [
  { short: 'L', long: 'lunes' },
  { short: 'M', long: 'martes' },
  { short: 'X', long: 'miércoles' },
  { short: 'J', long: 'jueves' },
  { short: 'V', long: 'viernes' },
  { short: 'S', long: 'sábado' },
  { short: 'D', long: 'domingo' },
] as const;
