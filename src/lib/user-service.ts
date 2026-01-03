import { sql } from "./db";

export async function upsertIdentity(params: {
  provider: "apple" | "google";
  subject: string;
  email?: string | null;
  rawClaims: any;
}) {
  const { provider, subject, email, rawClaims } = params;

  const existing = await sql`
    select user_id from auth_identity
    where provider = ${provider} and subject = ${subject}
    limit 1
  `;
  if (existing?.length) {
    const userId = existing[0].user_id as string;
    await sql`
      update auth_identity
      set email = coalesce(${email}, email),
          raw_claims = ${rawClaims},
          updated_at = now()
      where provider = ${provider} and subject = ${subject}
    `;
    return userId;
  }

  const userId = `${provider}_${subject}`;
  await sql`insert into app_user(id) values (${userId}) on conflict do nothing`;

  await sql`
    insert into auth_identity(provider, subject, user_id, email, raw_claims)
    values (${provider}, ${subject}, ${userId}, ${email ?? null}, ${rawClaims})
  `;
  return userId;
}

export async function getUserProfile(userId: string) {
  const identities = await sql`
    select provider, subject, email, created_at, updated_at
    from auth_identity
    where user_id = ${userId}
  `;
  return { userId, identities };
}
