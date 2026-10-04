'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ADMIN_ICON_ACTION, ADMIN_INPUT } from '@/components/admin/ui-constants';
import { cn } from '@/lib/utils';
import { reservationsHref, type ReservationsState } from '../_lib/search-params';

export const SEARCH_DEBOUNCE_MS = 300;

/** Command-bar search: the URL (and so the server query) follows the text after a pause. */
export function SearchBox(props: { state: ReservationsState; delayMs?: number }) {
  const { state, delayMs = SEARCH_DEBOUNCE_MS } = props;
  const router = useRouter();
  const [value, setValue] = useState(state.q);
  const [seenQ, setSeenQ] = useState(state.q);
  const [sentQ, setSentQ] = useState<string | null>(null);

  // q changed in the URL: adopt it, unless it is our own debounced write landing
  // (then the user may already have typed more, which must not be overwritten).
  if (state.q !== seenQ) {
    setSeenQ(state.q);
    if (state.q !== sentQ) setValue(state.q);
  }

  useEffect(() => {
    const next = value.trim();
    if (next === state.q) return;
    const timer = setTimeout(() => {
      setSentQ(next);
      router.replace(reservationsHref(state, { q: next }), { scroll: false });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, state, delayMs, router]);

  return (
    <div role="search" className="relative min-w-0 flex-1">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Buscar reservas"
        placeholder="Nombre, código PP-XXXX o cédula…"
        className={cn(ADMIN_INPUT, 'bg-white pl-9 pr-11')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => setValue('')}
          className={cn(
            ADMIN_ICON_ACTION,
            'absolute right-0 top-0 grid cursor-pointer place-items-center rounded-lg text-muted-foreground hover:text-foreground',
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
