import { describe, it, expect } from 'vitest';
import { render } from '@react-email/components';
import { VoucherEmail } from './voucher-template';

const props = {
  firstName: 'Ana', lastName: 'Pérez', idType: 'V', idNumber: '12345678',
  code: 'PP-4F7K2', date: '2030-01-15', adults: 2, children: 1,
  totalUsd: 35, totalVes: 1277.5, bcvRate: 36.5,
  qrUrl: 'https://app.test/api/qr/uuid-1',
};

describe('VoucherEmail', () => {
  it('renders every field the gate needs', async () => {
    const html = await render(<VoucherEmail {...props} />);
    for (const expected of [
      'Ana Pérez', 'V-12345678', 'PP-4F7K2', '2030-01-15',
      '2 adultos', '1 niño', '$35.00', 'Bs. 1277.50', '36.5',
    ]) {
      expect(html).toContain(expected);
    }
    expect(html).toContain('https://app.test/api/qr/uuid-1');
  });

  it('renders a child-only party without a 0 adultos label', async () => {
    const html = await render(<VoucherEmail {...{ ...props, adults: 0, children: 2 }} />);
    expect(html).toContain('2 niños');
    expect(html).not.toContain('0 adultos');
  });
});
