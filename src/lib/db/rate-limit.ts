import { serviceClient } from './service-client';

/**
 * Fixed-window rate limit backed by Postgres (see the `check_rate_limit` SQL fn).
 * Returns true if the request is ALLOWED, false if the caller is over the limit.
 * Fails open: if the limiter DB call errors we let the request through rather
 * than blocking legitimate customers on an infra hiccup.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('rate-limit: check failed, allowing request:', error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.error('rate-limit: check threw, allowing request:', e);
    return true;
  }
}
