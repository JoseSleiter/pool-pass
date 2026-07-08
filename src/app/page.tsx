import { getPublicPrices, getTodayRemaining } from '@/app/actions/booking';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { HowItWorks, Amenities, Pricing, Gallery, RepeatCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [prices, remaining] = await Promise.all([getPublicPrices(), getTodayRemaining()]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero remaining={remaining} prices={prices} />
        <HowItWorks />
        <Amenities />
        <Pricing prices={prices} />
        <Gallery />
        <RepeatCta />
      </main>
      <SiteFooter />
    </>
  );
}
