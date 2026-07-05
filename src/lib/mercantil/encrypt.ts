import { createCipheriv, createHash } from 'crypto';

/**
 * AES-256-CBC, key = SHA-256(secret), zero IV, base64 output.
 * Cipher convention per spec — verify against Mercantil's integration
 * doc before the production smoke test. Only this file changes if it differs.
 */
export function encryptField(value: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = Buffer.alloc(16, 0);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('base64');
}
