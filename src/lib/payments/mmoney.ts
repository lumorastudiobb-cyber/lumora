import type { PaymentPayload } from './cibc';

export interface MMoneyResult {
  success: boolean;
  provider: 'mmoney';
  reference: string;
  message: string;
}

export async function processMmoneyPayment(payload: PaymentPayload): Promise<MMoneyResult> {
  const formattedBbd = payload.amountBbd.toFixed(2);
  const toastMessage = `mMoney payment of BBD $${formattedBbd} would be processed here`;

  console.log('[mMoney Wallet] Initiating mobile wallet prompt:', {
    orderId: payload.orderId,
    amountBbd: formattedBbd,
    amountUsd: payload.amountUsd.toFixed(2),
    clientEmail: payload.clientEmail,
  });

  return {
    success: true,
    provider: 'mmoney',
    reference: `MMONEY-${Date.now()}`,
    message: toastMessage,
  };
}
