import { NextResponse } from "next/server";
import { processNotificationSignedPayload } from "@/lib/iap-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signedPayload = body?.signedPayload;
    if (!signedPayload) return NextResponse.json({ ok: false, error: "Missing signedPayload" }, { status: 400 });
    const result = await processNotificationSignedPayload(signedPayload);
    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "notification failed" }, { status: 200 });
  }
}
