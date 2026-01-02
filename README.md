# iOS IAP Backend (Neon + Vercel) — Backend Only

A production-ready backend skeleton for **iOS In-App Purchase** using:
- Neon Postgres (DATABASE_URL)
- Vercel deployment (Next.js API Routes)
- StoreKit 2 transaction verification (JWS via Apple's JWKS)
- App Store Server API v2 (optional transaction lookup by transactionId)
- App Store Server Notifications v2 (webhook) to keep subscription status updated

## What you get

### API endpoints
- `POST /api/iap/verify` — verify transaction and upsert into DB (idempotent)
- `GET  /api/iap/status?userId=...` — query user's current subscription/transactions
- `POST /api/iap/notifications` — App Store Server Notifications v2 callback (JWS verified)

### DB tables
- `app_user`
- `iap_transaction` (unique by `transaction_id`)
- `iap_subscription_state` (unique by `original_transaction_id`)
- optional `iap_product`

See `schema.sql`.

---

## 1) Create Neon database + schema

1. Create a Neon project and copy the **connection string**.
2. Open Neon SQL Editor and run:

```sql
-- paste contents of schema.sql
```

---

## 2) App Store Connect setup (for Server API v2)

If you only verify `signedTransactionInfo`, you can run without Server API.
But for best reliability (esp. when the client only sends `transactionId`), configure:

1. App Store Connect → Users and Access → Keys → Create an API Key
2. Record:
   - Issuer ID  -> `APPLE_ISSUER_ID`
   - Key ID     -> `APPLE_KEY_ID`
   - Download `.p8` -> `APPLE_PRIVATE_KEY`

Also set:
- `APPLE_BUNDLE_ID` (your app's bundle id)

---

## 3) Configure App Store Server Notifications v2

App Store Connect → My Apps → (your app) → In-App Purchases → App Store Server Notifications

Set the URL:
- `https://<your-vercel-domain>/api/iap/notifications`

Apple will POST JSON with `signedPayload` (JWS). We verify it using Apple's JWKS.

**Important: userId mapping**
Notifications do not include your `userId`.
We map notifications to users via:
- `originalTransactionId -> userId` stored during your `/verify` call.
So you must ensure your client calls `/verify` at least once per subscription chain.

---

## 4) Local dev

```bash
npm i
cp .env.example .env.local
# fill env vars
npm run dev
```

Test quickly:
```bash
curl -X GET 'http://localhost:3000/api/iap/status?userId=test'
```

---

## 5) Deploy to Vercel

### Option A: Vercel dashboard
1. Push this repo to GitHub
2. Vercel → Add New Project → Import from GitHub
3. Add env vars (Project Settings → Environment Variables):
   - DATABASE_URL
   - APPLE_BUNDLE_ID
   - APPLE_ISSUER_ID
   - APPLE_KEY_ID
   - APPLE_PRIVATE_KEY
   - APPLE_ENV (optional)
4. Deploy

### Option B: Vercel CLI
```bash
npm i -g vercel
vercel login
vercel
# follow prompts
vercel env add DATABASE_URL
# add the rest...
vercel --prod
```

---

## 6) Client integration contract

### POST /api/iap/verify

**Request (recommended)**: send `signedTransactionInfo` from StoreKit2
```json
{
  "userId": "user_123",
  "signedTransactionInfo": "eyJhbGciOiJFUzI1NiIsImtpZCI6..."
}
```

**Request (alternative)**: only `transactionId` (backend will call App Store Server API v2)
```json
{
  "userId": "user_123",
  "transactionId": "2000001234567890",
  "env": "Sandbox"
}
```

**Response**
```json
{
  "ok": true,
  "result": {
    "transactionId": "2000001234567890",
    "originalTransactionId": "2000001111111111",
    "productId": "com.xxx.vip.monthly",
    "environment": "Sandbox",
    "status": "active",
    "purchaseDate": "2026-01-02T18:23:45.000Z",
    "expiresDate": "2026-02-02T18:23:45.000Z",
    "revocationDate": null
  }
}
```

### GET /api/iap/status?userId=...

**Response**
```json
{
  "ok": true,
  "data": {
    "subscriptions": [
      {
        "original_transaction_id": "2000001111111111",
        "product_id": "com.xxx.vip.monthly",
        "status": "active",
        "expires_date": "2026-02-02T18:23:45.000Z",
        "updated_at": "2026-01-02T18:23:45.000Z"
      }
    ],
    "transactions": [
      {
        "product_id": "com.xxx.removeads",
        "transaction_id": "2000002222222222",
        "status": "active",
        "purchase_date": "2026-01-01T10:00:00.000Z",
        "expires_date": null,
        "revocation_date": null,
        "environment": "Production",
        "updated_at": "2026-01-01T10:00:01.000Z"
      }
    ]
  }
}
```

---

## 7) Where to add your entitlement logic

Open: `src/lib/iap-service.ts`

Search for:
- `✅ TODO: Grant entitlements here (idempotent!)`

Recommended patterns:
- non-consumable: `user_entitlement(product_id unique, user_id)` insert on conflict do nothing
- consumable: `user_ledger(transaction_id unique, user_id, delta)` insert on conflict do nothing
- subscription: entitlement derived from `iap_subscription_state` (status=active && expires_date > now)

---

## Notes / Caveats
- This repo doesn't include auth; `userId` is passed in request. In production, you should replace it with your auth token verification.
- Apple notification retries: we return 200 even on errors to avoid repeated retries; add logging in production.
