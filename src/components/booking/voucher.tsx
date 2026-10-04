'use client';

import { useId } from 'react';
import Image from 'next/image';
import { Printer, Share2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { shortDateLabel } from '@/lib/dates';
import { landingContent, whatsappUrl } from '@/lib/landing-content';
import { whatsappShareUrl } from '@/lib/booking/share';
import type { BookingResult } from '@/lib/booking/process';

export type ConfirmedReservation = Extract<BookingResult, { ok: true }>['reservation'];

/**
 * Print only the ticket. Lives with the voucher (not in globals.css) so the
 * rule ships and dies with it. Everything that neither is nor contains the
 * ticket is removed from the print layout; the ticket's ancestors lose their
 * padding and shadows so it lands at the top of the first page.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  body *:not(:has([data-print-ticket])):not([data-print-ticket]):not([data-print-ticket] *) {
    display: none !important;
  }
  body *:has([data-print-ticket]) {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: none !important;
    max-width: none !important;
  }
  [data-print-ticket] {
    margin: 0 auto !important;
    box-shadow: none !important;
    border: 1px solid var(--navy) !important;
  }
  [data-print-ticket], [data-print-ticket] * {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

/** State 4 of the checkout: the confirmed pass, printable and shareable. */
export function Voucher(props: {
  reservation: ConfirmedReservation;
  email: string;
  firstName: string;
  lastName: string;
  idLabel: string;
  date: string;
  party: { adults: number; children: number };
}) {
  const t = useT();
  const locale = useLocale();
  const stepsTitleId = useId();
  const { reservation } = props;
  const dateLabel = shortDateLabel(props.date, locale);
  // Club, date and code only: no name, ID, email, amounts or the QR's UUID.
  // The guest picks the recipient, and the code alone does not get anyone in
  // (the gate scans the QR and checks the holder's ID).
  const shareHref = whatsappShareUrl(
    interpolate(t.done.shareText, { club: landingContent.clubName, date: dateLabel, code: reservation.code })
  );
  const steps = [interpolate(t.done.step1, { date: dateLabel }), t.done.step2, t.done.step3];

  return (
    <div className="mt-5 rounded-2xl bg-muted p-6 text-center">
      <style>{PRINT_CSS}</style>
      <p className="font-heading text-xl font-semibold">{t.done.confirmed}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t.done.sentTo} <strong className="text-navy">{props.email}</strong>.{' '}
        {t.done.showAtEntrance}
      </p>

      <article
        data-print-ticket=""
        aria-label={t.done.dayPass}
        className="mx-auto mt-5 max-w-sm overflow-hidden rounded-2xl bg-card text-left ring-1 ring-border"
      >
        <div className="bg-navy p-5 text-center text-white">
          {/* The margin belongs on this wrapper, not on Logo's className:
              that lands on the img inside the chip. */}
          <div className="mb-3 flex justify-center">
            <Logo variant="chip" className="h-9 w-auto" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-teal-soft">{t.done.dayPass}</p>
          <p data-testid="reservation-code" className="mt-1 font-heading text-4xl font-bold tracking-[0.12em]">
            {reservation.code}
          </p>
        </div>

        <div className="p-5">
          <div className="mx-auto w-fit rounded-xl bg-white p-3 ring-2 ring-navy">
            <Image
              unoptimized
              src={`/api/qr/${reservation.id}`}
              alt={t.done.qrAlt}
              width={208}
              height={208}
              className="block [image-rendering:pixelated]"
            />
          </div>

          <div className="mt-4 space-y-1 text-sm">
            <p><strong>{t.done.name}</strong> {props.firstName} {props.lastName}</p>
            <p><strong>{t.done.document}</strong> {props.idLabel}</p>
            <p><strong>{t.done.date}</strong> {dateLabel}</p>
            <p><strong>{t.done.attendees}</strong> {formatParty(t.party, props.party.adults, props.party.children)}</p>
            <p><strong>{t.done.paid}</strong> ${reservation.totalUsd.toFixed(2)} USD · Bs. {reservation.totalVes.toFixed(2)}</p>
          </div>

          <div className="mt-5 border-t border-dashed border-border pt-4">
            <h2 id={stepsTitleId} className="font-heading text-base font-semibold">{t.done.howToEnter}</h2>
            <ol aria-labelledby={stepsTitleId} className="mt-2 list-none space-y-2 text-sm">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-xs font-bold text-navy"
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </article>

      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-semibold text-white"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t.done.print}
        </button>
        <a
          href={shareHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-navy"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t.done.share}
        </a>
      </div>

      <a
        href={whatsappUrl()}
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-secondary-foreground underline-offset-4 hover:underline"
      >
        {t.done.whatsapp}
      </a>
    </div>
  );
}
