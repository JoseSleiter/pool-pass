import type { Metadata } from "next";
import { Fredoka, Rubik, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: 'Complejo Turístico Villa Victoria',
    template: '%s · Complejo Turístico Villa Victoria',
  },
  description:
    'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR. Sin colas, sin efectivo.',
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    siteName: 'Complejo Turístico Villa Victoria',
    title: 'Complejo Turístico Villa Victoria',
    description:
      'Reserva tu pase de piscina en línea, paga con Pago Móvil y entra con tu código QR.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fredoka.variable} ${rubik.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
