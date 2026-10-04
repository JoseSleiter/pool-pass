// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealOnScroll } from './reveal-on-scroll';

/** Minimal IntersectionObserver double: records targets and lets the test fire entries. */
class FakeObserver {
  static last: FakeObserver | null = null;
  targets: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords() {
    return [];
  }
  fire(isIntersecting: boolean) {
    this.callback(
      this.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver
    );
  }
}

/** Real-browser-like environment: IO available, motion preference and element position configurable. */
function stubBrowser({ reducedMotion = false, top = 2000 }: { reducedMotion?: boolean; top?: number } = {}) {
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reducedMotion && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

function renderReveal(delayMs?: number) {
  render(
    <RevealOnScroll delayMs={delayMs}>
      <p>Step content</p>
    </RevealOnScroll>
  );
  return screen.getByText('Step content').parentElement as HTMLElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeObserver.last = null;
});

describe('RevealOnScroll', () => {
  it('keeps content visible when IntersectionObserver is unavailable', () => {
    // jsdom has no IntersectionObserver: same path as an old browser.
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
  });

  it('hides below-the-fold content and reveals it once it scrolls into view', () => {
    stubBrowser();
    const box = renderReveal();
    expect(box).toHaveAttribute('data-reveal', 'hidden');

    FakeObserver.last!.fire(false);
    expect(box).toHaveAttribute('data-reveal', 'hidden');

    FakeObserver.last!.fire(true);
    expect(box).toHaveAttribute('data-reveal', 'shown');
    expect(FakeObserver.last!.disconnected).toBe(true);
  });

  it('never hides anything under prefers-reduced-motion', () => {
    stubBrowser({ reducedMotion: true });
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
    expect(FakeObserver.last).toBeNull();
  });

  it('never hides content that is already on screen when it hydrates', () => {
    stubBrowser({ top: 100 });
    const box = renderReveal();
    expect(box).not.toHaveAttribute('data-reveal');
  });

  it('applies the stagger delay as a transition delay', () => {
    expect(renderReveal(240).style.transitionDelay).toBe('240ms');
  });
});
