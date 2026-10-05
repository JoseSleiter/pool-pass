'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { Download, Share2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { useLocale, useT } from '@/lib/i18n/provider';
import { formatParty, interpolate } from '@/lib/i18n/format';
import { shortDateLabel } from '@/lib/dates';
import { landingContent, whatsappUrl } from '@/lib/landing-content';
import { voucherShareText, whatsappShareUrl } from '@/lib/booking/share';
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

/**
 * The QR as a File, fetched once when the voucher mounts so the share click can
 * call navigator.share synchronously (browsers drop the user gesture across an
 * await). null until ready, or when this browser can't share files — then the
 * share button falls back to a wa.me text link.
 */
function useShareableQr(id: string, code: string): File | null {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return;
    let cancelled = false;
    fetch(`/api/qr/${id}`)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`QR ${res.status}`))))
      .then((blob) => {
        const qr = new File([blob], `${code}-qr.png`, { type: 'image/png' });
        if (!cancelled && navigator.canShare({ files: [qr] })) setFile(qr);
      })
      .catch(() => {
        // Text fallback stays in place.
      });
    return () => {
      cancelled = true;
    };
  }, [id, code]);
  return file;
}

/** State 4 of the checkout: the confirmed pass, downloadable and shareable. */
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
  const shareText = voucherShareText(t.done, {
    club: landingContent.clubName,
    code: reservation.code,
    date: dateLabel,
    name: `${props.firstName} ${props.lastName}`,
    idLabel: props.idLabel,
    party: formatParty(t.party, props.party.adults, props.party.children),
    totalUsd: reservation.totalUsd,
    totalVes: reservation.totalVes,
  });
  const qrFile = useShareableQr(reservation.id, reservation.code);

  function openWhatsappText() {
    window.open(whatsappShareUrl(shareText), '_blank', 'noopener,noreferrer');
  }

  async function share() {
    // wa.me links carry text only; images need the system share sheet (mobile).
    if (!qrFile) return openWhatsappText();
    try {
      await navigator.share({ files: [qrFile], text: shareText });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // guest closed the sheet
      openWhatsappText();
    }
  }

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
        <a
          href={`/api/qr/${reservation.id}`}
          download={`${reservation.code}-qr.png`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-navy px-6 text-sm font-semibold text-white"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t.done.downloadQr}
        </a>
        <button
          type="button"
          onClick={share}
          data-share-mode={qrFile ? 'file' : 'text'}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-navy"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t.done.share}
        </button>
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
