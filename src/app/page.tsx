import {
  getPublicPrices,
  getTodayCapacity,
  getAvailability,
  getWeekendBookedPeople,
} from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { getDictionary, getLocale } from '@/lib/i18n';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Amenities, Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = todayCaracas().slice(0, 7);
  const [prices, today, availability, weekendPeople, locale] = await Promise.all([
    getPublicPrices(),
    getTodayCapacity(),
    getAvailability(month),
    getWeekendBookedPeople(), // never throws: null hides the chip
    getLocale(),
  ]);
  const t = getDictionary(locale);
  return (
    <>
      <SiteHeader t={t} />
      <main>
        <Hero
          t={t}
          today={today}
          weekendPeople={weekendPeople}
          prices={prices}
          initialAvailability={availability}
        />
        <Features t={t} />
        <HowItWorks t={t} />
        <Amenities t={t} />
        <FinalCta t={t} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
