import { landingContent, whatsappUrl, instagramUrl } from '@/lib/landing-content';
import { Logo } from '@/components/brand/logo';
import type { Dictionary } from '@/lib/i18n/types';

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="bg-navy px-6 py-8 text-sm text-white/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Logo variant="chip" className="h-12 w-auto" />
        <p className="text-white/60">
          {t.footer.tagline}
        </p>
      </div>
      <div className="mx-auto mt-4 flex max-w-5xl flex-col gap-1 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <span>
          📍 {landingContent.address} · ⏰ {t.content.hours}
        </span>
        <span>
          <a href={whatsappUrl()} className="hover:text-teal-soft">
            WhatsApp {landingContent.whatsapp}
          </a>
          {' · '}
          <a
            href={instagramUrl()}
            className="hover:text-teal-soft"
          >
            @{landingContent.instagram}
          </a>
        </span>
      </div>
    </footer>
  );
}
