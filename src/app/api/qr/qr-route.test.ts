import { describe, it, expect } from 'vitest';
import { GET } from './[id]/route';

const ID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('GET /api/qr/[id]', () => {
  it('returns a PNG encoding the check-in URL', async () => {
    const res = await GET(new Request(`https://app.test/api/qr/${ID}`), {
      params: Promise.resolve({ id: ID }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const bytes = Buffer.from(await res.arrayBuffer());
    // PNG magic bytes
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('rejects non-UUID ids', async () => {
    const res = await GET(new Request('https://app.test/api/qr/x'), {
      params: Promise.resolve({ id: '../etc' }),
    });
    expect(res.status).toBe(400);
  });
});
