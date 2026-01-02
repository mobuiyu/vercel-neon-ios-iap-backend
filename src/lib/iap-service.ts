import { sql } from "./db";
import { verifySignedTransactionInfo } from "./apple-jws";

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID!;

export async function verifyAndUpsertTransaction(userId: string, signed: string) {
  const p = await verifySignedTransactionInfo(signed, BUNDLE_ID);
  await sql`insert into app_user(id) values (${userId}) on conflict do nothing`;
  await sql`
    insert into iap_transaction(user_id, product_id, transaction_id, raw)
    values (${userId}, ${p.productId}, ${p.transactionId}, ${p})
    on conflict (transaction_id) do nothing
  `;
  return { transactionId: p.transactionId, productId: p.productId };
}

export async function getStatus(userId: string) {
  return sql`
    select product_id, transaction_id
    from iap_transaction
    where user_id = ${userId}
    order by created_at desc
  `;
}
