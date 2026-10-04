import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { BookingCard } from '@/components/booking/booking-card';
import { getPublicPrices, getAvailability, getTodayRemaining } from '@/app/actions/booking';
import { parseBookingParams } from '@/lib/booking/search-params';
import { getDictionary, getLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ pay?: string; date?: string; adults?: string; children?: string }>;
}) {
  const sp = await searchParams;
  const { date, adults, children } = parseBookingParams(sp);
  // Anchor availability to the carried date's month so the calendar matches the selection.
  const month = date.slice(0, 7);
  const [prices, availability, remaining, locale] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
    getTodayRemaining(),
    getLocale(),
  ]);
  const t = getDictionary(locale);
  return (
    <>
      <SiteHeader t={t} />
      <main className="flex-1 bg-background px-5 py-10 sm:py-14">
        <BookingCard
          prices={prices}
          initialAvailability={availability}
          remaining={remaining}
          startAtPay={sp.pay === '1'}
          initialDate={date}
          initialAdults={adults}
          initialChildren={children}
        />
      </main>
      <SiteFooter t={t} />
    </>
  );
}
