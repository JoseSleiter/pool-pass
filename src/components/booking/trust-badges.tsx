'use client';

import { Lock, Smartphone } from 'lucide-react';
import { useT } from '@/lib/i18n/provider';

/**
 * Only literal facts (roadmap §2): Banco Mercantil is the C2P processor
 * (src/lib/mercantil/client.ts) and the document, phone and C2P key are
 * AES-256-CBC encrypted before they are sent (src/lib/mercantil/encrypt.ts).
 * If either stops being true, change the copy.
 */
export function TrustBadges() {
  const t = useT();
  const badges = [
    { key: 'c2p', Icon: Smartphone, text: t.trust.c2pMercantil },
    { key: 'aes', Icon: Lock, text: t.trust.encrypted },
  ];
  return (
    <ul aria-label={t.trust.title} className="mt-4 flex flex-wrap justify-center gap-2">
      {badges.map(({ key, Icon, text }) => (
        <li
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {text}
        </li>
      ))}
    </ul>
  );
}
