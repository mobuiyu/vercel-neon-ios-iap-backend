import { verifyJwt } from "./jwt";

export async function getUserIdFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) throw new Error("Missing Authorization header");
  return verifyJwt(auth.slice(7));
}
