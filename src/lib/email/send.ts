import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { VoucherEmail, QR_CID, LOGO_CID } from './voucher-template';
import { voucherText } from './voucher-text';
import { LOGO_PNG_BASE64 } from './logo-data';
import { qrPngBuffer } from '@/lib/qr';
import { visitLabelEs } from '@/lib/dates';
import type { VoucherData } from '@/lib/booking/process';

/**
 * Sends the voucher email over SMTP (Gmail by default).
 *
 * The QR and the logo travel as inline attachments rather than as remote
 * URLs: Gmail blocks remote images by default for untrusted senders, which
 * would deliver the pass without the code the gate needs to scan.
 *
 * Required env:
 *   SMTP_USER  — the full Gmail address (e.g. reservas.villavictoria@gmail.com)
 *   SMTP_PASS  — a Gmail *App Password* (16 chars, requires 2-Step Verification)
 *   NEXT_PUBLIC_APP_URL — public site URL, encoded in the QR's check-in link
 * Optional env:
 *   SMTP_HOST  (default: smtp.gmail.com)
 *   SMTP_PORT  (default: 465 → implicit TLS; use 587 for STARTTLS)
 *   VOUCHER_FROM_EMAIL (default: SMTP_USER)
 */
export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  // Pre-render to html: @react-email's dynamic render path is an optional peer
  // dep that is not hoisted here, so we render up front and pass plain html.
  const html = await render(VoucherEmail(v));
  const qr = await qrPngBuffer(v.reservationId);

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.VOUCHER_FROM_EMAIL || process.env.SMTP_USER,
    to: v.email,
    subject: `Tu pase para el ${visitLabelEs(v.date)} — ${v.code}`,
    html,
    text: voucherText(v),
    attachments: [
      { filename: 'pase-qr.png', content: qr, cid: QR_CID, contentType: 'image/png' },
      {
        filename: 'logo.png',
        content: Buffer.from(LOGO_PNG_BASE64, 'base64'),
        cid: LOGO_CID,
        contentType: 'image/png',
      },
    ],
  });

  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`smtp: no se pudo entregar a ${info.rejected.join(', ')}`);
  }
}
