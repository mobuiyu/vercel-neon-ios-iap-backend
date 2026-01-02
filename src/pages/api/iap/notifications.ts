import type { NextApiRequest, NextApiResponse } from "next";
import { verifySignedNotificationPayload } from "@/lib/apple-jws";
import { verifyAndUpsertTransaction, findUserIdByOriginalTransactionId } from "@/lib/iap-service";

/**
 * App Store Server Notifications v2 endpoint.
 * Apple POSTs { signedPayload } which is a JWS. We verify it using Apple's JWKS.
 *
 * IMPORTANT: mapping notification -> userId
 * - We rely on originalTransactionId -> userId mapping saved during /verify.
 * - If no mapping exists yet (e.g. user never verified on your server), we return 200 and do nothing.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { signedPayload } = req.body || {};
    if (!signedPayload) return res.status(400).json({ ok: false, error: "Missing signedPayload" });

    const notif = await verifySignedNotificationPayload(signedPayload);

    const signedTx = notif?.data?.signedTransactionInfo;
    const txId = notif?.data?.transactionId;
    const orig = notif?.data?.originalTransactionId;

    if (!signedTx && !txId) {
      // Some notification types may not include a transaction payload; acknowledge anyway.
      return res.status(200).json({ ok: true, note: "no transaction info" });
    }

    // Find user mapping
    let userId: string | null = null;
    if (orig) userId = await findUserIdByOriginalTransactionId(orig);

    if (!userId) {
      // No mapping yet; acknowledge so Apple doesn't retry forever.
      return res.status(200).json({ ok: true, note: "no user mapping yet", notificationType: notif.notificationType, subtype: notif.subtype });
    }

    const result = await verifyAndUpsertTransaction({
      userId,
      signedTransactionInfo: signedTx,
      transactionId: txId
    });

    return res.status(200).json({ ok: true, result, notificationType: notif.notificationType, subtype: notif.subtype });
  } catch (e: any) {
    // Apple will retry on non-2xx; better to 200 and log in real systems.
    return res.status(200).json({ ok: false, error: e?.message || "notification failed" });
  }
}
