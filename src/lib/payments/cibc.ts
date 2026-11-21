export interface PaymentPayload {
  amountBbd: number;
  amountUsd: number;
  orderId: string;
  clientEmail: string;
}

export interface PaymentResult {
  success: boolean;
  provider: 'cibc';
  reference: string;
  message: string;
}

export async function processCibcPayment(payload: PaymentPayload): Promise<PaymentResult> {
  const formattedBbd = payload.amountBbd.toFixed(2);
  const toastMessage = `CIBC payment of BBD $${formattedBbd} would be processed here`;

  console.log('[CIBC First Pay] Initiating checkout session:', {
    merchantId: process.env.CIBC_MERCHANT_ID || 'CIBC_TEST_MERCHANT',
    orderId: payload.orderId,
    amountBbd: formattedBbd,
    amountUsd: payload.amountUsd.toFixed(2),
    clientEmail: payload.clientEmail,
  });

  return {
    success: true,
    provider: 'cibc',
    reference: `CIBC-${Date.now()}`,
    message: toastMessage,
  };
}
