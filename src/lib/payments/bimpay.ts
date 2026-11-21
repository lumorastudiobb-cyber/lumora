import type { PaymentPayload } from './cibc';

export interface BimPayResult {
  success: boolean;
  provider: 'bimpay';
  reference: string;
  message: string;
}

export async function processBimpayPayment(payload: PaymentPayload): Promise<BimPayResult> {
  const formattedBbd = payload.amountBbd.toFixed(2);
  const toastMessage = `BimPay payment of BBD $${formattedBbd} would be processed here`;

  console.log('[BimPay Instant] Initiating QR & deep-link request:', {
    orderId: payload.orderId,
    amountBbd: formattedBbd,
    amountUsd: payload.amountUsd.toFixed(2),
    clientEmail: payload.clientEmail,
  });

  return {
    success: true,
    provider: 'bimpay',
    reference: `BIMPAY-${Date.now()}`,
    message: toastMessage,
  };
}
