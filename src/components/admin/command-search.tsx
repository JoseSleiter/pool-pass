'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADMIN_INPUT } from './ui-constants';

/** Where the global search sends the operator (roadmap §2: ⌘K → /admin/reservations?q=…). */
export function commandSearchHref(q: string): string {
  const term = q.trim();
  return term ? `/admin/reservations?${new URLSearchParams({ q: term })}` : '/admin/reservations';
}

/** ⌘K on Apple keyboards, Ctrl K elsewhere. */
export function shortcutLabel(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K';
}

export function isCommandK(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
): boolean {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
}

const noSubscribe = () => () => {};

/** Server and first client render say "Ctrl K"; the client then switches to ⌘K on Apple devices. */
function useShortcutLabel(): string {
  return useSyncExternalStore(noSubscribe, () => shortcutLabel(navigator.platform), () => 'Ctrl K');
}

/** Visible entry point for the global search (sidebar and mobile bar, navy background). */
export function CommandSearchButton(props: { onClick: () => void; compact?: boolean }) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label="Buscar reservas"
      aria-keyshortcuts="Meta+K Control+K"
      title={`Buscar reservas (${shortcut})`}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl text-sm text-white/70 transition-colors motion-reduce:transition-none',
        'hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-teal',
        props.compact ? 'size-11 shrink-0 justify-center self-center' : 'w-full border border-white/15 px-3',
      )}
    >
      <Search aria-hidden className="size-5 shrink-0" />
      {!props.compact && (
        <>
          <span className="flex-1 text-left">Buscar…</span>
          <kbd className="rounded-md border border-white/20 px-1.5 py-0.5 font-sans text-xs">{shortcut}</kbd>
        </>
      )}
    </button>
  );
}

/** Global ⌘K / Ctrl+K reservation search: type, Enter, land on the filtered list. */
export function CommandSearch(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { onOpenChange } = props;
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!isCommandK(e)) return;
      e.preventDefault();
      onOpenChange(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(commandSearchHref(q));
    setQ('');
    onOpenChange(false);
  }

  return (
    <Dialog open={props.open} onOpenChange={(open) => onOpenChange(open)}>
      <DialogPopup initialFocus={inputRef} className="top-[12vh] w-[min(36rem,calc(100vw-2rem))] translate-y-0 p-3">
        <DialogTitle className="sr-only">Buscar reservas</DialogTitle>
        <form role="search" onSubmit={submit} className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            aria-label="Nombre, código o cédula"
            placeholder="Nombre, código PP-XXXX o cédula…"
            enterKeyHint="search"
            autoComplete="off"
            className={cn(ADMIN_INPUT, 'pl-11')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <p className="mt-2 px-1 text-xs text-muted-foreground">Enter para buscar en Reservas · Esc para cerrar</p>
      </DialogPopup>
    </Dialog>
  );
}
