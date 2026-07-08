import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { whatsappUrl } from '@/lib/landing-content';
import { partyLabel } from '@/lib/party';
import { shortDateEs } from '@/lib/dates';
import type { BookingInput } from '@/lib/schemas';

export function Confirmation(props: {
  booking: BookingInput;
  reservation: { id: string; code: string; totalUsd: number; totalVes: number; bcvRate: number };
  idLabel: string; // e.g. "V-12345678"
}) {
  const r = props.reservation;
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-extrabold">¡Reserva confirmada! 🎉</h2>
      <p className="text-muted-foreground">
        Tu pase también llegó a <strong>{props.booking.email}</strong>.
        Muestra este QR (o el del correo) en la entrada junto a tu documento.
      </p>
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white">
          <p className="text-xs uppercase tracking-widest text-sky-200">Pase del día</p>
          <p data-testid="reservation-code" className="text-3xl font-black tracking-wider">{r.code}</p>
        </div>
        <CardContent className="space-y-3 p-4">
          <Image
            unoptimized
            src={`/api/qr/${r.id}`}
            alt="Código QR de tu pase"
            width={176}
            height={176}
            className="mx-auto"
          />
          <div className="space-y-1 text-left text-sm">
            <p><strong>Nombre:</strong> {props.booking.firstName} {props.booking.lastName}</p>
            <p><strong>Documento:</strong> {props.idLabel}</p>
            <p><strong>Fecha:</strong> {shortDateEs(props.booking.date)}</p>
            <p><strong>Asistentes:</strong> {partyLabel(props.booking.adults, props.booking.children)}</p>
            <p><strong>Pagado:</strong> ${r.totalUsd.toFixed(2)} / Bs. {r.totalVes.toFixed(2)} (tasa {r.bcvRate.toFixed(2)})</p>
          </div>
        </CardContent>
      </Card>
      <a
        href={whatsappUrl()}
        className="inline-block rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-700"
      >
        💬 ¿Dudas? Escríbenos por WhatsApp
      </a>
    </div>
  );
}
