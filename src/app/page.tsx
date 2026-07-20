import { getPublicPrices, getTodayRemaining, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const month = todayCaracas().slice(0, 7);
  const [prices, remaining, availability] = await Promise.all([
    getPublicPrices(),
    getTodayRemaining(),
    getAvailability(month),
  ]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero remaining={remaining} prices={prices} initialAvailability={availability} />
        <Features />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
