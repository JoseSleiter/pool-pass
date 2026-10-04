import { es, enUS } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { Locale } from './types';

/** date-fns locale for the calendar (react-day-picker accepts date-fns locales). */
export function dateFnsLocale(locale: Locale): DateFnsLocale {
  return locale === 'en' ? enUS : es;
}
