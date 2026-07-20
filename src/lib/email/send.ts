import 'server-only';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { VoucherEmail } from './voucher-template';
import type { VoucherData } from '@/lib/booking/process';

export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/${v.reservationId}`;
  // Pre-render to html: resend's `react` field dynamically imports
  // @react-email/render, an optional peer dep that is not hoisted in this
  // project, so that path fails before any API call is made.
  const html = await render(VoucherEmail({ ...v, qrUrl }));
  const { error } = await resend.emails.send({
    from: process.env.VOUCHER_FROM_EMAIL!,
    to: v.email,
    subject: `Tu pase de piscina — ${v.code}`,
    html,
  });
  if (error) throw new Error(`resend: ${error.message}`);
}
