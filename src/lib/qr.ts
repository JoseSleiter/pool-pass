import QRCode from 'qrcode';

/** Absolute check-in URL encoded in a reservation's QR code. */
export function checkInUrl(reservationId: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/admin/checkin/${reservationId}`;
}

/**
 * PNG bytes of a reservation's check-in QR.
 *
 * Shared by GET /api/qr/[id] and the voucher email so the code the guest is
 * shown and the code the gate scans cannot drift apart.
 */
export async function qrPngBuffer(reservationId: string): Promise<Buffer> {
  return QRCode.toBuffer(checkInUrl(reservationId), { width: 360, margin: 1 });
}
