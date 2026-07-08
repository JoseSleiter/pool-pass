import { landingContent, whatsappUrl } from '@/lib/landing-content';

export function SiteFooter() {
  return (
    <footer className="bg-[#0c4a6e] px-5 py-8 text-sm text-sky-200">
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="font-extrabold text-white">🌊 {landingContent.clubName}</p>
        <p>📍 {landingContent.address} · ⏰ {landingContent.hours}</p>
        <p>
          💬 <a href={whatsappUrl()} className="underline">WhatsApp {landingContent.whatsapp}</a>
          {' · '}
          📷 <a href={`https://instagram.com/${landingContent.instagram}`} className="underline">@{landingContent.instagram}</a>
        </p>
        <p className="pt-2 text-xs text-sky-400">© {new Date().getFullYear()} {landingContent.clubName}</p>
      </div>
    </footer>
  );
}
