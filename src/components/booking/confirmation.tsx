import { Card, CardContent } from '@/components/ui/card';
import type { BookingInput } from '@/lib/schemas';

export function Confirmation(props: {
  booking: BookingInput;
  reservation: { code: string; totalUsd: number; totalVes: number; bcvRate: number };
  idLabel: string; // e.g. "V-12345678"
}) {
  const r = props.reservation;
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-bold">¡Reserva confirmada!</h2>
      <p className="text-muted-foreground">
        Te enviamos el pase a <strong>{props.booking.email}</strong>. Si no llega,
        presenta estos datos en la entrada junto a tu cédula.
      </p>
      <Card>
        <CardContent className="space-y-1 pt-4 text-left">
          <p><strong>Código:</strong> <span data-testid="reservation-code">{r.code}</span></p>
          <p><strong>Nombre:</strong> {props.booking.firstName} {props.booking.lastName}</p>
          <p><strong>Documento:</strong> {props.idLabel}</p>
          <p><strong>Fecha:</strong> {props.booking.date}</p>
          <p><strong>Asistentes:</strong> {props.booking.adults} adultos, {props.booking.children} niños</p>
          <p><strong>Pagado:</strong> ${r.totalUsd.toFixed(2)} / Bs. {r.totalVes.toFixed(2)} (tasa {r.bcvRate.toFixed(2)})</p>
        </CardContent>
      </Card>
    </div>
  );
}
