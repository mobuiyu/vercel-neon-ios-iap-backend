import { sql } from "./db";
import { verifySignedTransactionInfo } from "./apple-jws";
import { getTransactionInfo } from "./appstore-api";

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID;
if (!BUNDLE_ID) throw new Error("Missing APPLE_BUNDLE_ID");

function toIso(ms?: number) {
  return ms ? new Date(ms).toISOString() : null;
}

function computeStatus(p: { expiresDate?: number; revocationDate?: number }) {
  const now = Date.now();
  if (p.revocationDate) return "revoked";
  if (p.expiresDate && p.expiresDate < now) return "expired";
  return "active";
}

/**
 * Verify a transaction and upsert into DB (idempotent by transaction_id).
 * You should plug your own entitlement granting logic in the marked section.
 */
export async function verifyAndUpsertTransaction(params: {
  userId: string;
  signedTransactionInfo?: string;
  transactionId?: string;
  env?: "Sandbox" | "Production";
}) {
  const { userId } = params;
  if (!userId) throw new Error("Missing userId");
  if (!params.signedTransactionInfo && !params.transactionId) {
    throw new Error("Provide signedTransactionInfo or transactionId");
  }

  // Ensure user exists (replace with your real auth/user table if needed)
  await sql`insert into app_user(id) values (${userId}) on conflict do nothing`;

  let signed = params.signedTransactionInfo;
  let env = params.env;

  // If only transactionId provided, fetch signedTransactionInfo from App Store Server API v2
  if (!signed && params.transactionId) {
    const info = await getTransactionInfo(params.transactionId, env);
    signed = info.signedTransactionInfo;
    if (!signed) throw new Error("Server API returned no signedTransactionInfo");
  }

  const payload = await verifySignedTransactionInfo(signed!, BUNDLE_ID);

  env = payload.environment || env || "Production";

  const transactionId = payload.transactionId;
  const originalTransactionId = payload.originalTransactionId ?? null;
  const productId = payload.productId;

  const purchaseDate = toIso(payload.purchaseDate);
  const expiresDate = toIso(payload.expiresDate);
  const revocationDate = toIso(payload.revocationDate);

  const status = computeStatus(payload);

  const rows = await sql`
    insert into iap_transaction(
      user_id, product_id, transaction_id, original_transaction_id,
      purchase_date, expires_date, revocation_date,
      environment, status, raw
    ) values (
      ${userId}, ${productId}, ${transactionId}, ${originalTransactionId},
      ${purchaseDate}, ${expiresDate}, ${revocationDate},
      ${env}, ${status}, ${payload as any}
    )
    on conflict (transaction_id) do update set
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      original_transaction_id = excluded.original_transaction_id,
      purchase_date = excluded.purchase_date,
      expires_date = excluded.expires_date,
      revocation_date = excluded.revocation_date,
      environment = excluded.environment,
      status = excluded.status,
      raw = excluded.raw,
      updated_at = now()
    returning transaction_id, product_id, status, expires_date, original_transaction_id
  `;

  const tx = rows[0];

  // Subscription state maintenance (by originalTransactionId)
  if (originalTransactionId) {
    await sql`
      insert into iap_subscription_state(
        original_transaction_id, user_id, product_id, status,
        expires_date, last_transaction_id, raw
      ) values (
        ${originalTransactionId}, ${userId}, ${productId}, ${status},
        ${expiresDate}, ${transactionId}, ${payload as any}
      )
      on conflict (original_transaction_id) do update set
        user_id = excluded.user_id,
        product_id = excluded.product_id,
        status = excluded.status,
        expires_date = excluded.expires_date,
        last_transaction_id = excluded.last_transaction_id,
        raw = excluded.raw,
        updated_at = now()
    `;
  }

  // ✅ TODO: Grant entitlements here (idempotent!)
  // Example pattern:
  // 1) Create a user_entitlement table and insert on conflict do nothing using transactionId as unique key.
  // 2) For consumables, create a ledger table (transaction_id unique) and add credits.
  // 3) For subscriptions, your entitlement check should be based on iap_subscription_state where status=active and expires_date>now.

  return {
    transactionId: tx.transaction_id as string,
    originalTransactionId: tx.original_transaction_id as string | null,
    productId: tx.product_id as string,
    environment: env,
    status: tx.status as string,
    purchaseDate,
    expiresDate,
    revocationDate
  };
}

export async function getUserEntitlementStatus(userId: string) {
  const subscriptions = await sql`
    select original_transaction_id, product_id, status, expires_date, updated_at
    from iap_subscription_state
    where user_id = ${userId}
    order by updated_at desc
  `;

  const transactions = await sql`
    select product_id, transaction_id, status, purchase_date, expires_date, revocation_date, environment, updated_at
    from iap_transaction
    where user_id = ${userId}
    order by purchase_date desc nulls last, updated_at desc
    limit 100
  `;

  return { subscriptions, transactions };
}

export async function findUserIdByOriginalTransactionId(originalTransactionId: string) {
  const rows = await sql`
    select user_id from iap_subscription_state
    where original_transaction_id = ${originalTransactionId}
    limit 1
  `;
  return (rows?.[0]?.user_id as string | undefined) || null;
}
