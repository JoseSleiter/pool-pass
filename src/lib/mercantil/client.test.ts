import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { payC2p, type C2pRequest } from './client';

const req: C2pRequest = {
  amountVes: 1625.55,
  destinationBankCode: '0105',
  destinationId: 'V12345678',
  destinationPhone: '04141234567',
  otp: '12345678',
  invoiceNumber: 'PP-4F7K2',
};

const cfg = {
  baseUrl: 'https://bank.test',
  clientId: 'cid',
  merchantId: '123',
  integratorId: '31',
  terminalId: '1',
  secretKey: 'test-secret-key',
  mock: false,
};

describe('payC2p', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns approved with the payment reference on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction_c2p_response: { trx_status: 'approved', payment_reference: 'REF-1' },
        }),
        { status: 200 }
      )
    );
    const res = await payC2p(req, cfg);
    expect(res).toEqual({ status: 'approved', reference: 'REF-1' });
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://bank.test/v1/payment/pay');
    expect((init.headers as Record<string, string>)['X-IBM-Client-Id']).toBe('cid');
    const body = JSON.parse(init.body as string);
    // sensitive fields must be encrypted, not plaintext
    expect(body.transaction_c2p.destination_id).not.toBe('V12345678');
    expect(body.transaction_c2p.twofactor_auth).not.toBe('12345678');
    expect(body.transaction_c2p.amount).toBe(1625.55);
  });

  it('serializes destination_bank_id as a number (bankCode "0105" → 105)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction_c2p_response: { trx_status: 'approved', payment_reference: 'REF-1' },
        }),
        { status: 200 }
      )
    );
    await payC2p(req, cfg);
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(init.body as string);
    // numeric per Mercantil samples: '0105' → 105
    expect(body.transaction_c2p.destination_bank_id).toBe(105);
  });

  it('returns declined with the error description on rejection', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction_c2p_response: {
            trx_status: 'rejected',
            trx_status_description: 'Clave inválida',
          },
        }),
        { status: 200 }
      )
    );
    const res = await payC2p(req, cfg);
    expect(res).toEqual({ status: 'declined', message: 'Clave inválida' });
  });

  it('maps a non-terminal trx_status (pending) to unknown, never declined', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          transaction_c2p_response: { trx_status: 'pending' },
        }),
        { status: 200 }
      )
    );
    const res = await payC2p(req, cfg);
    expect(res.status).toBe('unknown');
  });

  it('returns unknown on an error response without a transaction envelope (HTTP 401)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'AUTH' } }), { status: 401 })
    );
    const res = await payC2p(req, cfg);
    expect(res.status).toBe('unknown');
  });

  it('returns unknown on network failure (never assume declined)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ETIMEDOUT'));
    const res = await payC2p(req, cfg);
    expect(res.status).toBe('unknown');
  });

  it('mock mode: OTP 999999 declines, others approve without network', async () => {
    const mockCfg = { ...cfg, mock: true };
    expect((await payC2p(req, mockCfg)).status).toBe('approved');
    expect((await payC2p({ ...req, otp: '999999' }, mockCfg)).status).toBe('declined');
    expect(fetch).not.toHaveBeenCalled();
  });
});
