'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fades its children up the first time they scroll into view.
 *
 * Progressive enhancement: the server renders the content fully visible and
 * this island only hides it after hydration, and only when (a) the browser
 * has IntersectionObserver, (b) the visitor has not asked for reduced motion
 * and (c) the element is still below the fold. Without JS, with reduced
 * motion, or for content already on screen, nothing is ever hidden.
 */
export function RevealOnScroll({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger between siblings, applied as `transition-delay`. */
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.setAttribute('data-reveal', 'hidden');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.setAttribute('data-reveal', 'shown');
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      // Never leave content hidden behind a torn-down observer.
      if (el.getAttribute('data-reveal') === 'hidden') el.removeAttribute('data-reveal');
    };
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn(
        // Tailwind v4 translate utilities use the `translate` property, not `transform`.
        'motion-safe:transition-[opacity,translate] motion-safe:duration-700 motion-safe:ease-out',
        'data-[reveal=hidden]:translate-y-6 data-[reveal=hidden]:opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}
