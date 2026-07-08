import Link from 'next/link';
import { BookingWizard } from '@/components/booking/booking-wizard';
import { getPublicPrices, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';
import { landingContent } from '@/lib/landing-content';

export const dynamic = 'force-dynamic';

export default async function ReservarPage() {
  // Anchor "current month" to Venezuela's clock, not the server's (UTC rolls over ~4h early).
  const month = todayCaracas().slice(0, 7);
  const [prices, availability] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
  ]);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="Volver al inicio" className="font-bold text-sky-600">←</Link>
          <h1 className="font-extrabold">Reservar</h1>
          <span className="ml-auto text-xs text-muted-foreground">🌊 {landingContent.clubName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">
        <BookingWizard prices={prices} initialAvailability={availability} />
      </main>
    </div>
  );
}
