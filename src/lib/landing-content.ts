export const landingContent = {
  clubName: 'Complejo Turístico Villa Victoria',
  tagline: 'Tu día de piscina, a un clic',
  subtitle: 'Reserva online, paga con Pago Móvil y entra con tu QR. Sin colas, sin efectivo.',
  steps: [
    { icon: '📅', text: 'Elige fecha' },
    { icon: '📲', text: 'Paga C2P' },
    { icon: '✉️', text: 'Recibe tu QR' },
    { icon: '🏊', text: 'Entra directo' },
  ],
  amenities: [
    { icon: '🏊', text: 'Piscina para adultos y niños' },
    { icon: '🛡️', text: 'Salvavidas certificados' },
    { icon: '🍔', text: 'Comida y bebidas' },
    { icon: '🅿️', text: 'Estacionamiento gratis' },
    { icon: '🪑', text: 'Toldos y tumbonas' },
    { icon: '🚿', text: 'Duchas y vestuarios' },
  ],
  address: 'Tumeremo, Bolívar, Venezuela',
  // TODO: horario real — este es inventado y sale en el footer de cada página.
  hours: 'Mar–Dom · 9:00 am – 6:00 pm',
  whatsapp: '+58 424-9196984',
  instagram: 'finca_villa_victoria',
} as const;

export function whatsappUrl(): string {
  return `https://wa.me/${landingContent.whatsapp.replace(/\D/g, '')}`;
}

export function instagramUrl(): string {
  return `https://instagram.com/${landingContent.instagram}`;
}
