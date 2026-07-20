import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VoucherData } from '@/lib/booking/process';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { sendVoucherEmail } from './send';

const voucher: VoucherData = {
  reservationId: 'uuid-1', code: 'PP-4F7K2', email: 'ana@example.com',
  firstName: 'Ana', lastName: 'Pérez', idType: 'V', idNumber: '12345678',
  date: '2030-01-15', adults: 2, children: 1,
  totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5,
};

describe('sendVoucherEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
    vi.stubEnv('VOUCHER_FROM_EMAIL', 'pases@app.test');
  });

  it('sends pre-rendered html containing the code and QR url', async () => {
    sendMock.mockResolvedValue({ error: null });

    await sendVoucherEmail(voucher);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.from).toBe('pases@app.test');
    expect(arg.to).toBe('ana@example.com');
    expect(arg.subject).toBe('Tu pase de piscina — PP-4F7K2');
    expect(arg.react).toBeUndefined();
    expect(typeof arg.html).toBe('string');
    expect(arg.html).toContain('PP-4F7K2');
    expect(arg.html).toContain('https://app.test/api/qr/uuid-1');
  });

  it('throws when resend reports an error', async () => {
    sendMock.mockResolvedValue({ error: { message: 'invalid api key' } });

    await expect(sendVoucherEmail(voucher)).rejects.toThrow('resend: invalid api key');
  });
});
