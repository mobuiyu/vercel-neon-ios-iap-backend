import { NextResponse } from "next/server";
import { getStatus } from "@/lib/iap-service";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
  }
  const data = await getStatus(userId);
  return NextResponse.json({ ok: true, data });
}
