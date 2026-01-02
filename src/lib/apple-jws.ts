import { createRemoteJWKSet, jwtVerify } from "jose";
const jwks = createRemoteJWKSet(
  new URL("https://api.storekit.itunes.apple.com/in-app-purchase/publicKeys")
);
export async function verifySignedTransactionInfo(jws: string, bundleId: string) {
  const { payload } = await jwtVerify(jws, jwks);
  const p: any = payload;
  if (p.bundleId !== bundleId) throw new Error("bundleId mismatch");
  return p;
}
