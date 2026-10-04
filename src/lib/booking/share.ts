/**
 * WhatsApp "share" link: opens WhatsApp's own contact picker with `text`
 * prefilled. Deliberately no recipient number — the guest chooses who sees it.
 * Callers decide the text; keep personal data (name, ID, email) out of it.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
