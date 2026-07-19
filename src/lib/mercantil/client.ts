import 'server-only';
import { encryptField } from './encrypt';

export interface C2pRequest {
  amountVes: number;
  destinationBankCode: string;
  destinationId: string; // e.g. V12345678
  destinationPhone: string; // e.g. 04141234567
  otp: string;
  invoiceNumber: string; // our reservation code
}

export type C2pResult =
  | { status: 'approved'; reference: string }
  | { status: 'declined'; message: string }
  | { status: 'unknown'; message: string }; // timeout/ambiguous — do NOT release capacity

export interface MercantilConfig {
  baseUrl: string;
  clientId: string;
  merchantId: string;
  integratorId: string;
  terminalId: string;
  secretKey: string;
  mock: boolean;
}

export function mercantilConfigFromEnv(): MercantilConfig {
  return {
    baseUrl: process.env.MERCANTIL_BASE_URL!,
    clientId: process.env.MERCANTIL_CLIENT_ID!,
    merchantId: process.env.MERCANTIL_MERCHANT_ID!,
    integratorId: process.env.MERCANTIL_INTEGRATOR_ID!,
    terminalId: process.env.MERCANTIL_TERMINAL_ID ?? '1',
    secretKey: process.env.MERCANTIL_SECRET_KEY!,
    mock: process.env.MERCANTIL_MOCK === '1',
  };
}

export async function payC2p(req: C2pRequest, cfg: MercantilConfig): Promise<C2pResult> {
  if (cfg.mock) {
    return req.otp === '999999'
      ? { status: 'declined', message: 'Clave inválida (mock)' }
      : { status: 'approved', reference: `MOCK-${Date.now()}` };
  }

  const payload = {
    merchant_identify: {
      integratorId: Number(cfg.integratorId),
      merchantId: cfg.merchantId,
      terminalId: cfg.terminalId,
    },
    client_identify: { ipaddress: '127.0.0.1', browser_agent: 'PoolPass/1.0' },
    transaction_c2p: {
      trx_type: 'compra',
      payment_method: 'c2p',
      currency: 'ves',
      amount: req.amountVes,
      // numeric per Mercantil samples ('0105' → 105); wire-contract item in deploy checklist
      destination_bank_id: Number(req.destinationBankCode),
      destination_id: encryptField(req.destinationId, cfg.secretKey),
      destination_mobile_number: encryptField(req.destinationPhone, cfg.secretKey),
      twofactor_auth: encryptField(req.otp, cfg.secretKey),
      invoice_number: req.invoiceNumber,
    },
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/v1/payment/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-IBM-Client-Id': cfg.clientId },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json().catch(() => null);
    const trx = body?.transaction_c2p_response;
    if (trx?.trx_status === 'approved') {
      return { status: 'approved', reference: String(trx.payment_reference ?? '') };
    }
    // Only explicitly terminal rejections release capacity; anything else
    // (pending, unrecognized statuses, missing envelope) stays 'unknown'.
    if (trx?.trx_status === 'rejected' || trx?.trx_status === 'denied') {
      return { status: 'declined', message: String(trx.trx_status_description ?? 'Pago rechazado') };
    }
    return {
      status: 'unknown',
      message: `Estado no terminal (${trx?.trx_status ?? 'HTTP ' + res.status})`,
    };
  } catch (e) {
    console.error('mercantil: payment request failed:', e);
    return { status: 'unknown', message: e instanceof Error ? e.message : 'Fallo de red' };
  }
}
