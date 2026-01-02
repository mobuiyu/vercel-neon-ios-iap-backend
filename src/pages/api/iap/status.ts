import type { NextApiRequest, NextApiResponse } from "next";
import { getUserEntitlementStatus } from "@/lib/iap-service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const data = await getUserEntitlementStatus(userId);
    return res.status(200).json({ ok: true, data });
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: e?.message || "status failed" });
  }
}
