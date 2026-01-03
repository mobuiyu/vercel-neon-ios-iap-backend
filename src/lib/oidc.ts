import { createRemoteJWKSet, jwtVerify } from "jose";

const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type AppleIdTokenClaims = {
  iss: "https://appleid.apple.com";
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: "true" | "false" | boolean;
  [k: string]: any;
};

export async function verifyAppleIdToken(idToken: string) {
  const expectedAud = process.env.APPLE_SIGNIN_CLIENT_ID;
  if (!expectedAud) throw new Error("Missing APPLE_SIGNIN_CLIENT_ID");

  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: "https://appleid.apple.com",
    audience: expectedAud,
    clockTolerance: "5s"
  });

  const p = payload as any as AppleIdTokenClaims;
  if (!p.sub) throw new Error("Invalid Apple id_token (missing sub)");
  return p;
}

export type GoogleIdTokenClaims = {
  iss: "accounts.google.com" | "https://accounts.google.com";
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  [k: string]: any;
};

export async function verifyGoogleIdToken(idToken: string) {
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAud) throw new Error("Missing GOOGLE_CLIENT_ID");

  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience: expectedAud,
    clockTolerance: "5s"
  });

  const p = payload as any as GoogleIdTokenClaims;
  if (p.iss !== "accounts.google.com" && p.iss !== "https://accounts.google.com") {
    throw new Error("Invalid Google id_token issuer");
  }
  if (!p.sub) throw new Error("Invalid Google id_token (missing sub)");
  return p;
}
