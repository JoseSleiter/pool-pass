import type { VoucherData } from '@/lib/booking/process';

export async function sendVoucherEmail(v: VoucherData): Promise<void> {
  console.log('voucher email stub', v.code); // replaced in the email task
}
