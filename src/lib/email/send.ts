import 'server-only';
import nodemailer from 'nodemailer';
import { render } from '@react-email/components';
import { VoucherEmail } from './voucher-template';
import type { VoucherData } from '@/lib/booking/process';

/**
 * Sends the voucher email over SMTP (Gmail by default).
 *
 * Required env:
 *   SMTP_USER  — the full Gmail address (e.g. reservas.villavictoria@gmail.com)
 *   SMTP_PASS  — a Gmail *App Password* (16 chars, requires 2-Step Verification)
 *   NEXT_PUBLIC_APP_URL — public site URL, used to build the QR link in the email
 * Optional env:
 *   SMTP_HOST  (default: smtp.gmail.com)
 *   SMTP_PORT  (default: 465 → implicit TLS; use 587 for STARTTLS)
 *   VOUCHER_FROM_EMAIL (default: SMTP_USER)
 */
export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/${v.reservationId}`;
  // Pre-render to html: @react-email's dynamic render path is an optional peer
  // dep that is not hoisted here, so we render up front and pass plain html.
  const html = await render(VoucherEmail({ ...v, qrUrl }));

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
    subject: `Tu pase de piscina — ${v.code}`,
    html,
  });

  if (info.rejected && info.rejected.length > 0) {
    throw new Error(`smtp: no se pudo entregar a ${info.rejected.join(', ')}`);
  }
}
