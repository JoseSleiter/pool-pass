import { getPublicPrices, getTodayRemaining, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { getDictionary, getLocale } from '@/lib/i18n';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = todayCaracas().slice(0, 7);
  const [prices, remaining, availability, locale] = await Promise.all([
    getPublicPrices(),
    getTodayRemaining(),
    getAvailability(month),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  return (
    <>
      <SiteHeader t={t} />
      <main>
        <Hero t={t} remaining={remaining} prices={prices} initialAvailability={availability} />
        <Features t={t} />
        <HowItWorks t={t} />
        <FinalCta t={t} />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
