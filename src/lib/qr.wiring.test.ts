import { describe, it, expect, beforeEach, vi } from 'vitest';

const { toBufferMock } = vi.hoisted(() => ({
  toBufferMock: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
}));

vi.mock('qrcode', () => ({ default: { toBuffer: toBufferMock } }));

import { qrPngBuffer, checkInUrl } from './qr';

describe('qrPngBuffer wiring', () => {
  beforeEach(() => {
    toBufferMock.mockClear();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
  });

  it('encodes the check-in url, not the raw reservation id', async () => {
    const id = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
    await qrPngBuffer(id);
    expect(toBufferMock).toHaveBeenCalledWith(checkInUrl(id), { width: 360, margin: 1 });
  });
});
