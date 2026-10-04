import type { ReservationQuery, ReservationRow } from '@/lib/db/reservations';
import { DEFAULT_SORT, parseReservationQuery } from '@/lib/reservation-search';
import { STATUS_ORDER } from '@/lib/reservation-status';

/**
 * /admin/reservations keeps its whole state in the URL:
 * ?q=&status=(csv or repeated)&from=&to=&guest=&sort=&dir=&page=&pageSize=
 * Parsing is lenient (each bad value falls back to its default, never throws);
 * the result then goes through PR 02's zod parser before hitting the DB.
 */

export const RESERVATIONS_PATH = '/admin/reservations';

export type RawSearchParams = Record<string, string | string[] | undefined>;
type Status = ReservationRow['status'];
export type SortKey = NonNullable<ReservationQuery['sort']>['by'];
export type SortDir = NonNullable<ReservationQuery['sort']>['dir'];
export type GuestType = NonNullable<ReservationQuery['guestType']>;
export type PageSize = ReservationQuery['pageSize'];

/** Normalized list state ('' = not set). */
export interface ReservationsState {
  q: string;
  statuses: Status[];
  from: string;
  to: string;
  guest: GuestType | '';
  sort: SortKey;
  dir: SortDir;
  page: number;
  pageSize: PageSize;
}

export const SORT_KEYS = [
  'date', 'code', 'name', 'guests', 'total_usd', 'status',
] as const satisfies readonly SortKey[];
const PAGE_SIZES = [10, 25, 50] as const satisfies readonly PageSize[];
const GUEST_TYPES = ['individual', 'family'] as const satisfies readonly GuestType[];
const DIRS = ['asc', 'desc'] as const satisfies readonly SortDir[];
const MAX_PAGE = 10000;
const MAX_Q = 100;

export const DEFAULT_STATE: ReservationsState = {
  q: '', statuses: [], from: '', to: '', guest: '',
  sort: DEFAULT_SORT.by, dir: DEFAULT_SORT.dir, page: 1, pageSize: 10,
};

/** Newest first for dates; A→Z / low→high for every other column. */
export function defaultDir(sort: SortKey): SortDir {
  return sort === 'date' ? 'desc' : 'asc';
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function all(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function oneOf<T extends string | number>(options: readonly T[], value: unknown): T | undefined {
  return options.find((o) => o === value);
}

function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Lenient URL → state. Unknown or invalid values fall back to their defaults. */
export function parseReservationsState(sp: RawSearchParams): ReservationsState {
  const requested = new Set(all(sp.status).flatMap((v) => v.split(',')).map((s) => s.trim()));
  let from = isIsoDate(first(sp.from)) ? first(sp.from) : '';
  let to = isIsoDate(first(sp.to)) ? first(sp.to) : '';
  if (from && to && from > to) {
    from = '';
    to = '';
  }
  const sort = oneOf(SORT_KEYS, first(sp.sort)) ?? DEFAULT_STATE.sort;
  const page = Number(first(sp.page));
  return {
    q: first(sp.q).trim().slice(0, MAX_Q),
    statuses: STATUS_ORDER.filter((s) => requested.has(s)),
    from,
    to,
    guest: oneOf(GUEST_TYPES, first(sp.guest)) ?? '',
    sort,
    dir: oneOf(DIRS, first(sp.dir)) ?? defaultDir(sort),
    page: first(sp.page) !== '' && Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
    pageSize: oneOf(PAGE_SIZES, Number(first(sp.pageSize))) ?? DEFAULT_STATE.pageSize,
  };
}

/** State → validated query (PR 02's zod parser). null only if the state is somehow invalid. */
export function toReservationQuery(state: ReservationsState): ReservationQuery | null {
  return parseReservationQuery({
    page: state.page,
    pageSize: state.pageSize,
    sort: { by: state.sort, dir: state.dir },
    ...(state.q ? { q: state.q } : {}),
    ...(state.statuses.length > 0 ? { statuses: state.statuses } : {}),
    ...(state.from ? { dateFrom: state.from } : {}),
    ...(state.to ? { dateTo: state.to } : {}),
    ...(state.guest ? { guestType: state.guest } : {}),
  });
}

/** URL → { state, query }. Bad params degrade to defaults instead of erroring the page. */
export function parseReservationsParams(sp: RawSearchParams): { state: ReservationsState; query: ReservationQuery } {
  const state = parseReservationsState(sp);
  const query = toReservationQuery(state);
  if (query) return { state, query };
  return { state: DEFAULT_STATE, query: toReservationQuery(DEFAULT_STATE)! };
}
