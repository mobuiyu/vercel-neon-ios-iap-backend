import { sql } from "./db";
import { verifySignedTransactionInfo, verifySignedNotificationPayload, AppleTransactionPayload, AppleNotificationPayload } from "./apple-jws";

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID!;
if (!BUNDLE_ID) throw new Error("Missing APPLE_BUNDLE_ID");

type ProductKind = "consumable" | "non_consumable" | "subscription";

function toIso(ms?: number) { return ms ? new Date(ms).toISOString() : null; }
function computeStatus(p: AppleTransactionPayload) {
  const now = Date.now();
  if (p.revocationDate) return "revoked";
  if (p.expiresDate && p.expiresDate < now) return "expired";
  return "active";
}
function inferKind(p: AppleTransactionPayload): ProductKind {
  if (p.originalTransactionId || p.expiresDate) return "subscription";
  return "non_consumable";
}
async function getProductConfig(productId: string): Promise<{ kind: ProductKind; entitlements: any } | null> {
  const rows = await sql`select kind, entitlements from iap_product where product_id = ${productId} limit 1`;
  if (!rows?.length) return null;
  return { kind: rows[0].kind as ProductKind, entitlements: rows[0].entitlements };
}

async function grantEntitlements(args: {
  userId: string; productId: string; kind: ProductKind; transactionId: string;
  originalTransactionId: string | null; status: string; expiresDate: string | null; raw: any; productEntitlements: any;
}) {
  const { userId, productId, kind, transactionId, originalTransactionId, status, expiresDate, raw, productEntitlements } = args;

  if (kind === "subscription") {
    const otid = originalTransactionId || raw.originalTransactionId || transactionId;
    await sql`
      insert into iap_subscription_state(
        original_transaction_id, user_id, product_id, status,
        expires_date, last_transaction_id, raw
      ) values (
        ${otid}, ${userId}, ${productId}, ${status},
        ${expiresDate}, ${transactionId}, ${raw}
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
    return;
  }

  if (kind === "non_consumable") {
    await sql`
      insert into user_entitlement(user_id, product_id, source_transaction_id, meta)
      values (${userId}, ${productId}, ${transactionId}, ${productEntitlements})
      on conflict (user_id, product_id) do nothing
    `;
    return;
  }

  let credits: number | null = null;
  if (productEntitlements && typeof productEntitlements.credits === "number") credits = productEntitlements.credits;
  if (credits == null) {
    const fallback = Number(process.env.DEFAULT_CONSUMABLE_CREDITS || "0");
    credits = fallback > 0 ? fallback : 0;
  }

  await sql`
    insert into user_ledger(transaction_id, user_id, product_id, delta, meta)
    values (${transactionId}, ${userId}, ${productId}, ${credits}, ${productEntitlements})
    on conflict (transaction_id) do nothing
  `;
}

export async function verifyAndUpsertTransaction(userId: string, signedTransactionInfo: string) {
  const p = await verifySignedTransactionInfo(signedTransactionInfo, BUNDLE_ID);
  await sql`insert into app_user(id) values (${userId}) on conflict do nothing`;

  const transactionId = p.transactionId;
  const originalTransactionId = p.originalTransactionId ?? null;
  const productId = p.productId;

  const purchaseDate = toIso(p.purchaseDate);
  const expiresDate = toIso(p.expiresDate);
  const revocationDate = toIso(p.revocationDate);
  const status = computeStatus(p);
  const environment = p.environment ?? null;

  const config = await getProductConfig(productId);
  const kind: ProductKind = config?.kind ?? inferKind(p);
  const productEntitlements = config?.entitlements ?? {};

  await sql`
    insert into iap_transaction(
      user_id, product_id, kind, transaction_id, original_transaction_id,
      purchase_date, expires_date, revocation_date, environment, status, raw
    ) values (
      ${userId}, ${productId}, ${kind}, ${transactionId}, ${originalTransactionId},
      ${purchaseDate}, ${expiresDate}, ${revocationDate}, ${environment}, ${status}, ${p as any}
    )
    on conflict (transaction_id) do update set
      user_id = excluded.user_id,
      product_id = excluded.product_id,
      kind = excluded.kind,
      original_transaction_id = excluded.original_transaction_id,
      purchase_date = excluded.purchase_date,
      expires_date = excluded.expires_date,
      revocation_date = excluded.revocation_date,
      environment = excluded.environment,
      status = excluded.status,
      raw = excluded.raw,
      updated_at = now()
  `;

  await grantEntitlements({ userId, productId, kind, transactionId, originalTransactionId, status, expiresDate, raw: p, productEntitlements });

  return { transactionId, originalTransactionId, productId, kind, status, purchaseDate, expiresDate, revocationDate, environment };
}

export async function getUserStatus(userId: string) {
  const entitlements = await sql`select product_id, granted_at, source_transaction_id, meta from user_entitlement where user_id = ${userId} order by granted_at desc`;
  const balanceRows = await sql`select coalesce(sum(delta), 0) as balance from user_ledger where user_id = ${userId}`;
  const consumableBalance = Number(balanceRows?.[0]?.balance ?? 0);
  const subscriptions = await sql`select original_transaction_id, product_id, status, expires_date, updated_at from iap_subscription_state where user_id = ${userId} order by updated_at desc`;
  const transactions = await sql`select product_id, kind, transaction_id, status, purchase_date, expires_date, revocation_date, environment, updated_at from iap_transaction where user_id = ${userId} order by updated_at desc limit 50`;
  return { entitlements, consumableBalance, subscriptions, transactions };
}

// Notifications mapping + processing
export async function findUserIdForNotification(n: AppleNotificationPayload): Promise<string | null> {
  const orig = n?.data?.originalTransactionId;
  const txId = n?.data?.transactionId;
  if (orig) {
    const rows = await sql`select user_id from iap_subscription_state where original_transaction_id = ${orig} limit 1`;
    if (rows?.length) return rows[0].user_id as string;
  }
  if (txId) {
    const rows = await sql`select user_id from iap_transaction where transaction_id = ${txId} limit 1`;
    if (rows?.length) return rows[0].user_id as string;
  }
  return null;
}

export async function logNotification(args: {
  notificationUUID?: string; notificationType?: string; subtype?: string; environment?: string;
  originalTransactionId?: string; transactionId?: string; raw: any; mappedUserId?: string | null; processed: boolean; error?: string | null;
}) {
  const a = args;
  await sql`
    insert into iap_notification_log(
      notification_uuid, notification_type, subtype, environment,
      original_transaction_id, transaction_id, mapped_user_id, processed, error, raw
    ) values (
      ${a.notificationUUID ?? null},
      ${a.notificationType ?? null},
      ${a.subtype ?? null},
      ${a.environment ?? null},
      ${a.originalTransactionId ?? null},
      ${a.transactionId ?? null},
      ${a.mappedUserId ?? null},
      ${a.processed},
      ${a.error ?? null},
      ${a.raw}
    )
    on conflict (notification_uuid) do update set
      processed = excluded.processed,
      error = excluded.error,
      raw = excluded.raw,
      updated_at = now()
  `;
}

export async function processNotificationSignedPayload(signedPayload: string) {
  const notif = await verifySignedNotificationPayload(signedPayload);
  const mappedUserId = await findUserIdForNotification(notif);
  const signedTx = notif?.data?.signedTransactionInfo;
  const txId = notif?.data?.transactionId;

  if (!mappedUserId) {
    await logNotification({ notificationUUID: notif.notificationUUID, notificationType: notif.notificationType, subtype: notif.subtype,
      environment: notif?.data?.environment, originalTransactionId: notif?.data?.originalTransactionId, transactionId: txId,
      raw: notif, mappedUserId: null, processed: false, error: "no user mapping"
    });
    return { ok: true, processed: false, reason: "no user mapping", notificationType: notif.notificationType, subtype: notif.subtype };
  }

  if (signedTx) {
    const result = await verifyAndUpsertTransaction(mappedUserId, signedTx);
    await logNotification({ notificationUUID: notif.notificationUUID, notificationType: notif.notificationType, subtype: notif.subtype,
      environment: notif?.data?.environment, originalTransactionId: notif?.data?.originalTransactionId, transactionId: result.transactionId,
      raw: notif, mappedUserId, processed: true, error: null
    });
    return { ok: true, processed: true, userId: mappedUserId, result, notificationType: notif.notificationType, subtype: notif.subtype };
  }

  await logNotification({ notificationUUID: notif.notificationUUID, notificationType: notif.notificationType, subtype: notif.subtype,
    environment: notif?.data?.environment, originalTransactionId: notif?.data?.originalTransactionId, transactionId: txId,
    raw: notif, mappedUserId, processed: false, error: "missing signedTransactionInfo"
  });
  return { ok: true, processed: false, userId: mappedUserId, reason: "missing signedTransactionInfo", notificationType: notif.notificationType, subtype: notif.subtype };
}
