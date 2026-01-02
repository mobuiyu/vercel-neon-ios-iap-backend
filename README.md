# JWT-secured iOS IAP Backend (Next.js 16 + Vercel + Neon) — Entitlements + Notifications v2

This version adds **App Store Server Notifications v2** handling:
- Endpoint: `POST /api/iap/notifications` (called by Apple)
- Verifies `signedPayload` JWS via Apple's JWKS
- Maps notification to user via `originalTransactionId` (preferred) or `transactionId`
- If `data.signedTransactionInfo` exists, reuses verify flow to update DB + entitlements
- Logs all notifications into `iap_notification_log`

## Endpoints
- `POST /api/iap/verify` (JWT required)
- `GET  /api/iap/status` (JWT required)
- `POST /api/iap/notifications` (Apple, no JWT)

## Env vars
- `DATABASE_URL`
- `APPLE_BUNDLE_ID`
- `JWT_SECRET`
- Optional: `DEFAULT_CONSUMABLE_CREDITS`

## DB setup
Run `schema.sql` in Neon SQL Editor.

## Configure Notifications URL (App Store Connect)
App Store Connect → Your App → In-App Purchases → App Store Server Notifications:
- Set URL to: `https://YOUR_DOMAIN.vercel.app/api/iap/notifications`

Use “Send Test Notification” to validate delivery.

## Important: user mapping
Apple notifications do not know your user id. This backend maps notifications by:
1. `originalTransactionId` in `iap_subscription_state` (created when your client calls `/verify`)
2. fallback: `transactionId` in `iap_transaction`

So ensure your client calls `/verify` at least once per subscription chain (e.g., after purchase or during restore).

## Verify (client)
```bash
curl -X POST https://YOUR_DOMAIN.vercel.app/api/iap/verify \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"signedTransactionInfo":"<JWS>"}'
```

## Status (client)
```bash
curl https://YOUR_DOMAIN.vercel.app/api/iap/status \
  -H "Authorization: Bearer <JWT>"
```

## Debug notifications
Check `iap_notification_log` rows in Neon.
