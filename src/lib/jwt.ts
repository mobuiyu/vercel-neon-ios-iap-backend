import { jwtVerify, SignJWT } from "jose";
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
if (!process.env.JWT_SECRET) throw new Error("Missing JWT_SECRET");

export async function signJwt(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyJwt(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub) throw new Error("Invalid token");
  return payload.sub;
}
