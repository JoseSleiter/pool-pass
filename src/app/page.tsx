import { getPublicPrices, getTodayRemaining } from '@/app/actions/booking';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Features, HowItWorks, FinalCta } from '@/components/landing/sections';
import { SiteFooter } from '@/components/landing/site-footer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [prices, remaining] = await Promise.all([getPublicPrices(), getTodayRemaining()]);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero remaining={remaining} prices={prices} />
        <Features />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
