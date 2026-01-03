import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    const profile = await getUserProfile(userId);
    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unauthorized" }, { status: 401 });
  }
}
