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
  priority = false,
}: {
  variant?: 'chip' | 'plain';
  className?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src="/brand/logo.png"
      alt={landingContent.clubName}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
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
