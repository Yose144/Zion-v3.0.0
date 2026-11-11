import QRCode from 'qrcode';
import { COMPANY } from '@/lib/company';

/** Czech QR Platba (SPD) string — funguje v aplikacích českých bank. */
export function spdString(amountCzk: number, variableSymbol: string, message: string): string {
  const clean = message
    .replace(/\*/g, '')
    .slice(0, 35)
    .trim();
  return (
    'SPD*1.0' +
    `*ACC:${COMPANY.iban}` +
    `*AM:${amountCzk.toFixed(2)}` +
    '*CC:CZK' +
    `*MSG:${clean || 'Lumi'}` +
    `*X-VS:${variableSymbol}`
  );
}

export async function bankQrDataUrl(amountCzk: number, variableSymbol: string, message: string): Promise<string> {
  const svg = await QRCode.toString(spdString(amountCzk, variableSymbol, message), {
    type: 'svg',
    margin: 1,
    width: 320,
    color: { dark: '#101C2B', light: '#ffffff' },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function bankPaymentData(amountCzk: number, variableSymbol: string, orderNumber: string) {
  return {
    account: COMPANY.bankAccount,
    iban: COMPANY.iban,
    bic: COMPANY.bic,
    bankName: COMPANY.bankName,
    owner: COMPANY.bankOwner,
    amountCzk,
    variableSymbol,
    message: `Lumi ${orderNumber}`,
    qrCode: await bankQrDataUrl(amountCzk, variableSymbol, `Lumi ${orderNumber}`),
  };
}
