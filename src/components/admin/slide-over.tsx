'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ICON_ACTION } from './ui-constants';

/** Right-hand slide-over panel (base-ui Dialog: focus trap, Escape, focus return). */
export function SlideOver(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={props.open} onOpenChange={(open) => props.onOpenChange(open)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-navy-deep/40 transition-opacity duration-200 motion-reduce:transition-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl outline-none',
            'transition-transform duration-200 motion-reduce:transition-none',
            'data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
            <DialogPrimitive.Title className="font-heading text-lg font-extrabold text-navy">
              {props.title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Cerrar panel"
              className={cn(
                ADMIN_ICON_ACTION,
                'grid cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors motion-reduce:transition-none',
                'hover:bg-slate-100 hover:text-navy focus-visible:outline-2 focus-visible:outline-teal',
              )}
            >
              <X aria-hidden className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
          {props.footer && <div className="border-t border-slate-200 px-5 py-3">{props.footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
