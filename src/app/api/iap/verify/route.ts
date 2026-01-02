import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { verifyAndUpsertTransaction } from "@/lib/iap-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    const { signedTransactionInfo } = await req.json();
    if (!signedTransactionInfo) {
      return NextResponse.json({ ok: false, error: "Missing signedTransactionInfo" }, { status: 400 });
    }
    const result = await verifyAndUpsertTransaction(userId, signedTransactionInfo);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "verify failed" }, { status: 401 });
  }
}
