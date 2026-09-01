import QRCode from 'qrcode';

/** Absolute check-in URL encoded in a reservation's QR code. */
export function checkInUrl(reservationId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    // Without this the QR encodes "undefined/admin/checkin/..." — a pass that
    // scans fine and leads nowhere, discovered only at the gate.
    throw new Error('NEXT_PUBLIC_APP_URL is not set: cannot build a check-in URL');
  }
  return `${base}/admin/checkin/${reservationId}`;
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
