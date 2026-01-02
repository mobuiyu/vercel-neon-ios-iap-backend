import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Apple StoreKit / App Store Server JWS public keys (JWKS).
 * Used for verifying:
 * - StoreKit2 signedTransactionInfo
 * - App Store Server Notifications v2 signedPayload
 */
const jwks = createRemoteJWKSet(
  new URL("https://api.storekit.itunes.apple.com/in-app-purchase/publicKeys")
);

export type AppleTransactionPayload = {
  transactionId: string;
  originalTransactionId?: string;
  productId: string;
  bundleId: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  environment?: "Sandbox" | "Production";
  [k: string]: any;
};

export async function verifySignedTransactionInfo(jws: string, bundleId: string) {
  const { payload } = await jwtVerify(jws, jwks, { clockTolerance: "5s" });
  const p = payload as any as AppleTransactionPayload;
  if (p.bundleId !== bundleId) throw new Error("bundleId mismatch");
  if (!p.transactionId || !p.productId) throw new Error("missing transactionId/productId");
  return p;
}

export type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    appAppleId?: number;
    bundleId?: string;
    environment?: "Sandbox" | "Production";
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
    transactionId?: string;
    originalTransactionId?: string;
    productId?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

export async function verifySignedNotificationPayload(jws: string) {
  const { payload } = await jwtVerify(jws, jwks, { clockTolerance: "5s" });
  return payload as any as AppleNotificationPayload;
}
