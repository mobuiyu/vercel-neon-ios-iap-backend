import type { NextApiRequest, NextApiResponse } from "next";
import { verifyAndUpsertTransaction } from "@/lib/iap-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { userId, signedTransactionInfo, transactionId, env } = req.body || {};
    const result = await verifyAndUpsertTransaction({
      userId,
      signedTransactionInfo,
      transactionId,
      env
    });
    return res.status(200).json({ ok: true, result });
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: e?.message || "verify failed" });
  }
}
