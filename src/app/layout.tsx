import type { Metadata } from "next";
import { Fredoka, Rubik, Geist_Mono } from "next/font/google";
import { getDictionary, getLocale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";
import { landingContent } from "@/lib/landing-content";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * metadataBase only resolves relative metadata URLs, so a bad value is not
 * worth crashing the whole app for — new URL() throws at module scope in the
 * root layout, which would take down every route.
 */
function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const fallback = 'https://pool-pass.vercel.app';
  try {
    return new URL(configured || fallback);
  } catch {
    console.warn(
      `NEXT_PUBLIC_APP_URL is not a valid URL (${configured}); falling back to ${fallback}`
    );
    return new URL(fallback);
  }
}

// Resolved once at module load so a bad env value warns once, not per request.
const metadataBase = siteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  const club = landingContent.clubName;
  return {
    metadataBase,
    title: {
      default: club,
      template: `%s · ${club}`,
    },
    description: t.meta.description,
    openGraph: {
      type: 'website',
      locale: t.meta.ogLocale,
      siteName: club,
      title: club,
      description: t.meta.ogDescription,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${fredoka.variable} ${rubik.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} dict={getDictionary(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
