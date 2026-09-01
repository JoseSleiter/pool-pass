/**
 * Composes the voucher email for real and asserts on the wire bytes.
 *
 * send.test.ts mocks nodemailer wholesale, so it can only check the options
 * object handed to sendMail. The defect this branch fixes lives one layer
 * lower: the QR used to be a remote <img src="https://…/api/qr/…">, which
 * Gmail blocks by default, delivering a pass with no scannable code. The fix
 * is a cid: attachment, and "cid: works" means the assembled MIME really is
 * multipart/related with an inline Content-ID part the HTML points at.
 *
 * So here nodemailer is NOT mocked away: createTransport is swapped for one
 * that returns a real streamTransport transporter, which composes the exact
 * message it would have written to the socket and hands it back as a Buffer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VoucherData } from '@/lib/booking/process';

/**
 * nodemailer is CJS and `send.ts` reaches it through a default import, so the
 * namespace Vite hands back carries the module on `.default` — which the
 * `export =` typings do not describe.
 */
type Nodemailer = typeof import('nodemailer');
type NodemailerNamespace = Nodemailer & { default: Nodemailer };

const { createTransportMock } = vi.hoisted(() => ({ createTransportMock: vi.fn() }));
vi.mock('nodemailer', async (importOriginal) => {
  const actual = await importOriginal<NodemailerNamespace>();
  return { default: { ...actual.default, createTransport: createTransportMock } };
});

import { sendVoucherEmail } from './send';

const voucher: VoucherData = {
  reservationId: 'uuid-1', code: 'PP-4F7K2', email: 'ana@example.com',
  firstName: 'Ana', lastName: 'Pérez', idType: 'V', idNumber: '12345678',
  date: '2030-01-15', adults: 2, children: 1,
  totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5,
};

/**
 * Undo the transfer encodings that would otherwise hide a match: quoted-
 * printable soft line breaks split tokens mid-word (`cid:voucher-=\r\nqr`),
 * and folded headers put a CRLF + whitespace inside a header value.
 */
function unwrap(message: string): string {
  return message.replace(/=\r?\n/g, '').replace(/\r?\n[ \t]+/g, ' ');
}

/**
 * The composed message, as nodemailer would put it on the wire.
 *
 * vi.mock replaces the module for every importer, this file included, so the
 * real nodemailer has to come from importActual. Its streamTransport with
 * `buffer: true` runs the same MailComposer the SMTP transport does and
 * resolves with the finished message instead of opening a socket; send.ts
 * throws away the info object, so sendMail is wrapped to keep it.
 */
async function composeVoucher(): Promise<string> {
  const actual = await vi.importActual<NodemailerNamespace>('nodemailer');
  const transporter = actual.default.createTransport({ streamTransport: true, buffer: true });

  const sent: Buffer[] = [];
  createTransportMock.mockImplementation(() => ({
    sendMail: async (options: Parameters<typeof transporter.sendMail>[0]) => {
      const info = await transporter.sendMail(options);
      sent.push((info as unknown as { message: Buffer }).message);
      return info;
    },
  }));

  await sendVoucherEmail(voucher);
  expect(sent).toHaveLength(1);
  return sent[0].toString('utf8');
}

describe('voucher email MIME', () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_USER', 'club@gmail.com');
    vi.stubEnv('SMTP_PASS', 'app-password');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
    vi.stubEnv('VOUCHER_FROM_EMAIL', 'pases@app.test');
  });

  it('assembles the images as inline multipart/related parts the HTML points at', async () => {
    const raw = unwrap(await composeVoucher());

    // The container that makes cid: resolvable at all.
    expect(raw).toContain('multipart/related');

    // Each image is addressable by the id the template uses...
    expect(raw).toContain('Content-ID: <voucher-qr>');
    expect(raw).toContain('Content-ID: <brand-logo>');

    // ...and is marked inline, not as a download, in its own part.
    for (const [cid, filename] of [
      ['voucher-qr', 'pase-qr.png'],
      ['brand-logo', 'logo.png'],
    ]) {
      const start = raw.indexOf(`Content-ID: <${cid}>`);
      const headers = raw.slice(start, raw.indexOf('\r\n\r\n', start));
      expect(headers).toContain(`Content-Disposition: inline; filename=${filename}`);
    }
    expect(raw.match(/Content-Disposition: inline/g)).toHaveLength(2);

    // ...and the HTML part actually references them.
    expect(raw).toContain('cid:voucher-qr');
    expect(raw).toContain('cid:brand-logo');
  });

  it('embeds no remote QR URL — the defect this branch fixes', async () => {
    const raw = unwrap(await composeVoucher());

    // Gmail blocks remote images by default, so a linked QR ships an
    // unscannable pass. Nothing in the message may point at the QR route.
    expect(raw).not.toMatch(/https?:\/\/[^\s"'<>]*\/api\/qr\//);
  });
});
