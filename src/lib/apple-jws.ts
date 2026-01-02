import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Apple StoreKit / App Store Server JWS public keys (JWKS).
 * Used for verifying:
 * - StoreKit2 signedTransactionInfo
 * - App Store Server Notifications v2 signedPayload
 */
const APPLE_JWKS_URL = new URL(
  "https://api.storekit.itunes.apple.com/in-app-purchase/publicKeys"
);

const jwks = createRemoteJWKSet(APPLE_JWKS_URL);

export type AppleTransactionPayload = {
  transactionId: string;
  originalTransactionId?: string;
  productId: string;
  bundleId: string;
  purchaseDate?: number;   // ms epoch
  expiresDate?: number;    // ms epoch (subscription)
  revocationDate?: number; // ms epoch (refunded/revoked)
  environment?: "Sandbox" | "Production";
  [k: string]: any;
};

export async function verifySignedTransactionInfo(
  signedTransactionInfo: string,
  expectedBundleId: string
): Promise<AppleTransactionPayload> {
  const { payload } = await jwtVerify(signedTransactionInfo, jwks, {
    // Apple JWS may not include typical aud/iss fields.
    // Signature validation against Apple's JWKS is the main trust anchor.
    clockTolerance: "5s"
  });

  const p = payload as unknown as AppleTransactionPayload;

  if (!p.bundleId || p.bundleId !== expectedBundleId) {
    throw new Error("bundleId mismatch");
  }
  if (!p.transactionId || !p.productId) {
    throw new Error("missing transactionId/productId");
  }
  return p;
}

export type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  data?: {
    appAppleId?: number;
    bundleId?: string;
    environment?: "Sandbox" | "Production";
    signedRenewalInfo?: string;
    signedTransactionInfo?: string;
    transactionId?: string;
    originalTransactionId?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

export async function verifySignedNotificationPayload(
  signedPayload: string
): Promise<AppleNotificationPayload> {
  const { payload } = await jwtVerify(signedPayload, jwks, { clockTolerance: "5s" });
  return payload as unknown as AppleNotificationPayload;
}
