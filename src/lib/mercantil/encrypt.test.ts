import { describe, it, expect } from 'vitest';
import { createDecipheriv, createHash } from 'crypto';
import { encryptField } from './encrypt';

const SECRET = 'test-secret-key';

function decrypt(b64: string): string {
  const key = createHash('sha256').update(SECRET).digest();
  const iv = Buffer.alloc(16, 0);
  const d = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8');
}

describe('encryptField', () => {
  it('round-trips: decrypting the output recovers the plaintext', () => {
    expect(decrypt(encryptField('V12345678', SECRET))).toBe('V12345678');
  });

  it('is deterministic for the same input and secret', () => {
    expect(encryptField('04141234567', SECRET)).toBe(encryptField('04141234567', SECRET));
  });

  it('produces base64 output', () => {
    const out = encryptField('123456', SECRET);
    expect(Buffer.from(out, 'base64').toString('base64')).toBe(out);
  });
});
