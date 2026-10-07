// Provider-agnostic boundary for payments — docs/ARCHITECTURE.md leaves the
// choice between Xendit and Midtrans open ("evaluate... select after
// comparing fees, payment methods, webhook reliability, payout support, API
// quality, and Indonesian requirements", docs/PAYMENT.md). No SDK is
// installed; this only defines the shape future provider implementations
// must satisfy so the donation core never depends on a concrete provider.

export type PaymentProviderName = "XENDIT" | "MIDTRANS";

export interface CreatePaymentInput {
  /** Integer, minor currency unit — never a float (docs/CLAUDE.md rule 11). */
  amount: number;
  currency: string;
  reference: string;
}

export interface CreatePaymentResult {
  providerReference: string;
  redirectUrl: string;
}

/**
 * Verifies a webhook payload's signature and returns the parsed event, or
 * null if the signature is invalid. Implementations must never trust an
 * unverified payload (docs/SECURITY.md, docs/PAYMENT.md).
 */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}
