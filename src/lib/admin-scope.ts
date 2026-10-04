// src/lib/admin-scope.ts
import type { Locale } from '@/lib/i18n/types';

/**
 * Request header the middleware sets on every /admin/* request so the root
 * layout (which cannot see the pathname) knows it is rendering the admin.
 */
export const ADMIN_SCOPE_HEADER = 'x-pp-scope';
export const ADMIN_SCOPE = 'admin';

/** The admin is Spanish-only: its documents are lang="es" whatever pp_lang says. */
export function documentLocale(cookieLocale: Locale, scope: string | null): Locale {
  return scope === ADMIN_SCOPE ? 'es' : cookieLocale;
}
