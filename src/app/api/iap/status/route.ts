import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getUserStatus } from "@/lib/iap-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    const data = await getUserStatus(userId);
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unauthorized" }, { status: 401 });
  }
}
