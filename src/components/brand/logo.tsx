import Image from 'next/image';
import { landingContent } from '@/lib/landing-content';

/**
 * Intrinsic size of public/brand/logo.png. Printed by
 * scripts/build-brand-assets.mjs; update both if the source photo changes.
 */
const LOGO_WIDTH = 1240;
const LOGO_HEIGHT = 731;

/**
 * The club's logo.
 *
 * The mark is multicoloured on a light ground by design: its dark green tree
 * and navy mountain disappear against the site's navy. `chip` sets it on a
 * white pill so it stays legible there without recolouring it.
 */
export function Logo({
  variant = 'plain',
  className = 'h-11 w-auto',
  sizes = '224px',
  priority = false,
}: {
  variant?: 'chip' | 'plain';
  className?: string;
  /**
   * Load-bearing. Without `sizes`, next/image builds its srcset from device
   * widths alone (1920/3840) and serves an ~85 KB candidate for a slot that
   * renders at ~81 px wide — preloaded, since the header passes `priority`,
   * so it competes with the LCP. The default covers the largest current use
   * — the header's `sm:h-14`, ~95 px wide on a 1.7:1 lockup — at 2x DPR.
   */
  sizes?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src="/brand/logo.png"
      alt={landingContent.clubName}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );

  if (variant === 'plain') return image;

  return (
    <span className="inline-flex items-center rounded-2xl bg-white px-3 py-2 shadow-sm">
      {image}
    </span>
  );
}
