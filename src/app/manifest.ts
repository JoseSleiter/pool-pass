import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Complejo Turístico Villa Victoria',
    short_name: 'Villa Victoria',
    description: 'Reserva tu pase de piscina y entra con tu código QR.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    // Navy of the brand palette. The previous #0284c7 was a sky blue that
    // appears nowhere else in the project.
    theme_color: '#0b2a4a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
