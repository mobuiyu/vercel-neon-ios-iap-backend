import { NextResponse } from "next/server";
import { processNotificationSignedPayload } from "@/lib/iap-service";

export const runtime = "nodejs";

/**
 * App Store Server Notifications v2 callback.
 * Apple POSTs: { "signedPayload": "<JWS>" }
 *
 * We verify JWS signature using Apple's JWKS and:
 * - map notification to user via originalTransactionId/transactionId in DB
 * - if signedTransactionInfo present: reuse verifyAndUpsertTransaction to update status + entitlements
 * - log everything in iap_notification_log
 *
 * Note: Apple expects 2xx; we always return 200 with ok=true/false info for debugging.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signedPayload = body?.signedPayload;
    if (!signedPayload) {
      return NextResponse.json({ ok: false, error: "Missing signedPayload" }, { status: 400 });
    }

    const result = await processNotificationSignedPayload(signedPayload);
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    // Return 200 to avoid Apple retry storms; log is handled inside if verification passes.
    return NextResponse.json({ ok: false, error: e?.message || "notification failed" }, { status: 200 });
  }
}
