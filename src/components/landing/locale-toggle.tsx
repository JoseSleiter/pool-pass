'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocale } from '@/app/actions/locale';
import { useLocale, useT } from '@/lib/i18n/provider';
import { LOCALES, type Locale } from '@/lib/i18n/types';
import { cn } from '@/lib/utils';

/** Language names in their own language, shown as tooltips. */
const NATIVE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };

/** "ES | EN" switch. Saves the choice in the pp_lang cookie and re-renders the route. */
export function LocaleToggle() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t.header.language} className="flex items-center text-xs font-bold tracking-wider">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span aria-hidden className="text-white/40">|</span>}
          <button
            type="button"
            lang={l}
            title={NATIVE_NAMES[l]}
            aria-pressed={l === locale}
            disabled={pending}
            onClick={() => choose(l)}
            className={cn(
              'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-wait',
              l === locale ? 'text-white' : 'text-white/55 hover:text-teal-soft'
            )}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
