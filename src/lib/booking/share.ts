import type { Dictionary } from '@/lib/i18n/types';
import { interpolate } from '@/lib/i18n/format';

/**
 * WhatsApp "share" link: opens WhatsApp's own contact picker with `text`
 * prefilled. Deliberately no recipient number — the guest chooses who sees it.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export interface VoucherShareData {
  club: string;
  code: string;
  /** Already-localized visit date label. */
  date: string;
  name: string;
  idLabel: string;
  /** Already-localized party label ("2 adultos, 1 niño"). */
  party: string;
  totalUsd: number;
  totalVes: number;
}

/**
 * The whole voucher as plain text, sent with the QR image (Web Share) or alone
 * (wa.me fallback, where images can't travel). The guest asked to share it and
 * picks the recipient, so it carries everything the printed ticket shows.
 * No emoji: the wa.me → api.whatsapp.com redirect mangles them into "�".
 */
export function voucherShareText(t: Dictionary['done'], v: VoucherShareData): string {
  return [
    `${t.dayPass} · ${v.club}`,
    `${t.code} ${v.code}`,
    `${t.name} ${v.name}`,
    `${t.document} ${v.idLabel}`,
    `${t.date} ${v.date}`,
    `${t.attendees} ${v.party}`,
    `${t.paid} $${v.totalUsd.toFixed(2)} USD · Bs. ${v.totalVes.toFixed(2)}`,
    '',
    `${t.howToEnter}:`,
    `1. ${interpolate(t.step1, { date: v.date })}`,
    `2. ${t.step2}`,
    `3. ${t.step3}`,
  ].join('\n');
}
