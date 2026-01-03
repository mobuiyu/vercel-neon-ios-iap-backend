import { NextResponse } from "next/server";
import { verifyAppleIdToken, verifyGoogleIdToken } from "@/lib/oidc";
import { upsertIdentity } from "@/lib/user-service";
import { signJwt } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const provider = body?.provider as "apple" | "google";
    const idToken = body?.idToken as string;

    if (!provider || !idToken) {
      return NextResponse.json({ ok: false, error: "Missing provider/idToken" }, { status: 400 });
    }

    if (provider === "apple") {
      const claims = await verifyAppleIdToken(idToken);
      const userId = await upsertIdentity({ provider: "apple", subject: claims.sub, email: claims.email ?? null, rawClaims: claims });
      const jwt = await signJwt(userId);
      return NextResponse.json({ ok: true, jwt, userId, provider });
    }

    if (provider === "google") {
      const claims = await verifyGoogleIdToken(idToken);
      const userId = await upsertIdentity({ provider: "google", subject: claims.sub, email: claims.email ?? null, rawClaims: claims });
      const jwt = await signJwt(userId);
      return NextResponse.json({ ok: true, jwt, userId, provider });
    }

    return NextResponse.json({ ok: false, error: "Unsupported provider" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "exchange failed" }, { status: 401 });
  }
}
