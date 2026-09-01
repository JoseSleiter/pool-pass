import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkInUrl, qrPngBuffer } from './qr';

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('qr', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
  });

  it('builds the check-in url for a reservation', () => {
    expect(checkInUrl(ID)).toBe(`https://app.test/admin/checkin/${ID}`);
  });

  it('encodes that url as PNG bytes', async () => {
    const png = await qrPngBuffer(ID);
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png.length).toBeGreaterThan(100);
  });

  it('refuses to build a url when the app url is not configured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(() => checkInUrl(ID)).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
