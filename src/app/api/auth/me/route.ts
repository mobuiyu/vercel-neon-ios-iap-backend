import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth";
import { getUserProfile } from "@/lib/user-service";

export const runtime = "nodejs";

function logRequestHeaders(req: Request) {
  const auth = req.headers.get("authorization");

  console.log("[auth/me] ===== REQUEST HEADERS =====");
  console.log({
    authorization: auth
      ? auth.slice(0, 24) + "...(" + auth.length + " chars)"
      : null,
    userAgent: req.headers.get("user-agent"),
    contentType: req.headers.get("content-type"),
    forwardedFor: req.headers.get("x-forwarded-for"),
    vercelId: req.headers.get("x-vercel-id"),
    host: req.headers.get("host"),
  });
  console.log("[auth/me] ===========================");
}

export async function GET(req: Request) {
  try {
    logRequestHeaders(req);

    const userId = await getUserIdFromRequest(req);
    console.log("[auth/me] verified userId =", userId);

    const profile = await getUserProfile(userId);

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (e: any) {
    console.error("[auth/me] ERROR:", e?.message);

    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "unauthorized",
      },
      { status: 401 }
    );
  }
}
