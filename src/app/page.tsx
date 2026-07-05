import { BookingWizard } from '@/components/booking/booking-wizard';
import { getPublicPrices, getAvailability } from '@/app/actions/booking';
import { todayCaracas } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Anchor "current month" to Venezuela's clock, not the server's (UTC rolls over ~4h early).
  const month = todayCaracas().slice(0, 7);
  const [prices, availability] = await Promise.all([
    getPublicPrices(),
    getAvailability(month),
  ]);
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-1 text-2xl font-bold">Reserva tu pase de piscina</h1>
      <p className="mb-4 text-muted-foreground">Elige la fecha y cuántos asisten.</p>
      <BookingWizard prices={prices} initialAvailability={availability} />
    </main>
  );
}
