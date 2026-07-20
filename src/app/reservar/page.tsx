import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { BookingCard } from '@/components/booking/booking-card';
import { getPublicPrices, getAvailability, getTodayRemaining } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string }>;
}) {
  // Anchor "current month" to Venezuela's clock, not the server's (UTC rolls over ~4h early).
  const month = todayCaracas().slice(0, 7);
  const [prices, availability, remaining, sp] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
    getTodayRemaining(),
    searchParams,
  ]);
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-background px-5 py-10 sm:py-14">
        <BookingCard
          prices={prices}
          initialAvailability={availability}
          remaining={remaining}
          startAtPay={sp.pay === '1'}
        />
      </main>
      <SiteFooter />
    </>
  );
}
