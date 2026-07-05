import { Resend } from 'resend';
import { VoucherEmail } from './voucher-template';
import type { VoucherData } from '@/lib/booking/process';

export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/${v.reservationId}`;
  const { error } = await resend.emails.send({
    from: process.env.VOUCHER_FROM_EMAIL!,
    to: v.email,
    subject: `Tu pase de piscina — ${v.code}`,
    react: VoucherEmail({ ...v, qrUrl }),
  });
  if (error) throw new Error(`resend: ${error.message}`);
}
