import type { VoucherData } from '@/lib/booking/process';
import { partyLabel } from '@/lib/party';
import { visitLabelEs } from '@/lib/dates';
import { landingContent, whatsappUrl, instagramUrl } from '@/lib/landing-content';

/**
 * Plain-text alternative to the HTML voucher.
 *
 * An HTML-only message is a well-known spam signal, and the text part is what
 * clients that refuse HTML fall back to. It deliberately omits the QR: a code
 * cannot be expressed in text, so it points at the reservation code instead.
 */
export function voucherText(v: VoucherData): string {
  return [
    landingContent.clubName,
    '',
    `Tu pase de piscina: ${v.code}`,
    'Presenta este correo junto a tu cédula en la entrada.',
    '',
    `Nombre: ${v.firstName} ${v.lastName}`,
    `Documento: ${v.idType}-${v.idNumber}`,
    `Fecha: ${visitLabelEs(v.date)}`,
    `Asistentes: ${partyLabel(v.adults, v.children)}`,
    `Total pagado: $${v.totalUsd.toFixed(2)} / Bs. ${v.totalVes.toFixed(2)} (tasa BCV ${v.bcvRate.toFixed(2)})`,
    '',
    `Si el código QR no se ve, escríbenos: ${whatsappUrl()}`,
    `Síguenos en Instagram: ${instagramUrl()}`,
  ].join('\n');
}
