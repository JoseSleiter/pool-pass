import { landingContent, whatsappUrl } from '@/lib/landing-content';

export function SiteFooter() {
  return (
    <footer className="bg-navy px-6 py-8 text-sm text-white/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-heading text-base font-semibold uppercase tracking-[0.18em] text-white">
          {landingContent.clubName}
        </span>
        <p className="text-white/60">
          Reservas digitales · Pago Móvil C2P · Voucher por email
        </p>
      </div>
      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-1 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <span>
          📍 {landingContent.address} · ⏰ {landingContent.hours}
        </span>
        <span>
          <a href={whatsappUrl()} className="hover:text-teal-soft">
            WhatsApp {landingContent.whatsapp}
          </a>
          {' · '}
          <a
            href={`https://instagram.com/${landingContent.instagram}`}
            className="hover:text-teal-soft"
          >
            @{landingContent.instagram}
          </a>
        </span>
      </div>
    </footer>
  );
}
