/**
 * Design-system standards for the /admin path.
 *
 * Every interactive control is sized to a 44px touch target so the panel is
 * comfortably usable on mobile, and matches the 44px (`h-11`) inputs.
 * Import these instead of ad-hoc `size="sm"` / `h-*` classes so admin controls
 * stay consistent.
 */

/** Text action button (primary/secondary/destructive differ by variant, not size). */
export const ADMIN_ACTION = 'h-11 px-5';

/** Dialog action button: full-width on mobile, auto-width from the `sm` breakpoint up. */
export const DIALOG_ACTION = 'h-11 w-full px-5 sm:w-auto';

/** Square icon-only action button (edit/delete in lists). */
export const ADMIN_ICON_ACTION = 'size-11';

/** Text input / select / date field. */
export const ADMIN_INPUT = 'h-11 text-base';

/**
 * Dialog footer: dismiss action anchored left, primary action anchored right.
 * Stacks vertically (reverse, so primary stays on top) on the narrowest screens.
 */
export const DIALOG_FOOTER =
  'mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between';

/** Sidebar / drawer navigation row: full-width 44px touch target. */
export const ADMIN_NAV_ITEM = 'min-h-11 px-3';
