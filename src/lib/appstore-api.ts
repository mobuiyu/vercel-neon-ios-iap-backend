import { SignJWT, importPKCS8 } from "jose";

const ISSUER_ID = process.env.APPLE_ISSUER_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const PRIVATE_KEY_P8 = process.env.APPLE_PRIVATE_KEY;
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID;

const DEFAULT_ENV = (process.env.APPLE_ENV || "Production") as "Sandbox" | "Production";

function apiBase(env: "Sandbox" | "Production") {
  return env === "Sandbox"
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com";
}

function normalizePkcs8(p8: string) {
  // Accept raw base64-ish key without headers.
  if (p8.includes("BEGIN PRIVATE KEY")) return p8;
  const cleaned = p8.replace(/\r/g, "").trim();
  return `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`;
}

async function makeAppStoreJwt() {
  if (!ISSUER_ID || !KEY_ID || !PRIVATE_KEY_P8) {
    throw new Error("Missing App Store Connect API creds (APPLE_ISSUER_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY)");
  }
  if (!BUNDLE_ID) throw new Error("Missing APPLE_BUNDLE_ID");

  const pkcs8 = normalizePkcs8(PRIVATE_KEY_P8);
  const key = await importPKCS8(pkcs8, "ES256");

  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ bid: BUNDLE_ID })
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID, typ: "JWT" })
    .setIssuer(ISSUER_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 10) // 10 minutes
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

export async function getTransactionInfo(
  transactionId: string,
  env: "Sandbox" | "Production" = DEFAULT_ENV
) {
  const token = await makeAppStoreJwt();
  const res = await fetch(`${apiBase(env)}/inApps/v1/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getTransactionInfo failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ signedTransactionInfo?: string; [k: string]: any }>;
}
