import { NextResponse } from "next/server";
import { verifyAndUpsertTransaction } from "@/lib/iap-service";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.json();
  try {
    const result = await verifyAndUpsertTransaction(body.userId, body.signedTransactionInfo);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
