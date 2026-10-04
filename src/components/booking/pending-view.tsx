'use client';

import { useT } from '@/lib/i18n/provider';

/**
 * State 3b: the bank has not confirmed yet. No buttons on purpose — a retry
 * could charge twice. The server always sends the same sentence; the
 * dictionary holds it in both languages (pending.message).
 */
export function PendingView() {
  const t = useT();
  return (
    <div className="mt-5 rounded-2xl bg-amber-50 p-6 text-center ring-1 ring-amber-200">
      <div className="text-4xl" aria-hidden="true">⏳</div>
      <h2 className="mt-2 font-heading text-xl font-semibold text-amber-900">{t.pending.title}</h2>
      <p className="mt-2 text-sm text-amber-800">{t.pending.message}</p>
      <p className="mt-2 text-sm text-amber-800">{t.pending.doNotRetry}</p>
    </div>
  );
}
