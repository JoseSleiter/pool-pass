import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VoucherData } from '@/lib/booking/process';

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  return { sendMailMock, createTransportMock: vi.fn(() => ({ sendMail: sendMailMock })) };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
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
    sendMailMock.mockReset();
    createTransportMock.mockClear();
    vi.stubEnv('SMTP_HOST', 'smtp.gmail.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_USER', 'club@gmail.com');
    vi.stubEnv('SMTP_PASS', 'app-password');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test');
    vi.stubEnv('VOUCHER_FROM_EMAIL', 'pases@app.test');
  });

  it('attaches the QR and the logo instead of linking them remotely', async () => {
    sendMailMock.mockResolvedValue({ rejected: [], accepted: ['ana@example.com'] });

    await sendVoucherEmail(voucher);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.from).toBe('pases@app.test');
    expect(arg.to).toBe('ana@example.com');
    expect(arg.html).toContain('PP-4F7K2');
    expect(arg.html).not.toContain('https://app.test/api/qr/uuid-1');

    const cids = arg.attachments.map((a: { cid: string }) => a.cid);
    expect(cids).toEqual(['voucher-qr', 'brand-logo']);
    for (const a of arg.attachments) {
      expect(a.contentType).toBe('image/png');
      expect(Buffer.isBuffer(a.content)).toBe(true);
      expect(a.content.length).toBeGreaterThan(0);
    }
    for (const a of arg.attachments) expect(arg.html).toContain(`cid:${a.cid}`);
  });

  it('puts the visit date in the subject and ships a plain-text part', async () => {
    sendMailMock.mockResolvedValue({ rejected: [], accepted: ['ana@example.com'] });

    await sendVoucherEmail(voucher);

    const arg = sendMailMock.mock.calls[0][0];
    expect(arg.subject).toBe('Tu pase para el Mar, 15 Ene 2030 — PP-4F7K2');
    expect(arg.text).toContain('PP-4F7K2');
    expect(arg.text).toContain('Ana Pérez');
  });

  it('falls back to SMTP_USER as the from address when VOUCHER_FROM_EMAIL is unset', async () => {
    vi.stubEnv('VOUCHER_FROM_EMAIL', '');
    sendMailMock.mockResolvedValue({ rejected: [], accepted: ['ana@example.com'] });

    await sendVoucherEmail(voucher);

    expect(sendMailMock.mock.calls[0][0].from).toBe('club@gmail.com');
  });

  it('throws when SMTP rejects the recipient', async () => {
    sendMailMock.mockResolvedValue({ rejected: ['ana@example.com'], accepted: [] });

    await expect(sendVoucherEmail(voucher)).rejects.toThrow(/smtp/i);
  });
});
