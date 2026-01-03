# Backend: Apple/Google Login → JWT + iOS IAP (Next.js 16 + Vercel + Neon)

## 1) Deploy
1. Run `schema.sql` in Neon
2. Push to GitHub
3. Import into Vercel
4. Set env vars:
   - DATABASE_URL
   - JWT_SECRET
   - APPLE_SIGNIN_CLIENT_ID
   - GOOGLE_CLIENT_ID
   - APPLE_BUNDLE_ID
   - (optional) DEFAULT_CONSUMABLE_CREDITS
5. Deploy

## 2) Auth API

### POST /api/auth/exchange
Client obtains **Apple identityToken** (Sign in with Apple) or **Google ID token** (Google Sign-In),
then exchanges it for your backend JWT.

Request:
```json
{ "provider": "apple", "idToken": "<apple_id_token>" }
```
or
```json
{ "provider": "google", "idToken": "<google_id_token>" }
```

Response:
```json
{ "ok": true, "jwt": "<your_jwt>", "userId": "apple_<sub>", "provider": "apple" }
```

### GET /api/auth/me
Header:
`Authorization: Bearer <your_jwt>`

Response:
```json
{ "ok": true, "profile": { "userId": "...", "identities": [...] } }
```

## 3) IAP API (JWT required)

### POST /api/iap/verify
Header: `Authorization: Bearer <your_jwt>`
Body:
```json
{ "signedTransactionInfo": "<StoreKit2 signedTransactionInfo JWS>" }
```

### GET /api/iap/status
Header: `Authorization: Bearer <your_jwt>`

Returns entitlements, consumable balance, subscriptions, recent transactions.

## 4) Notifications v2
Set App Store Server Notifications URL to:
`https://YOUR_DOMAIN.vercel.app/api/iap/notifications`

Apple will POST:
```json
{ "signedPayload": "<JWS>" }
```

This backend verifies the signedPayload and:
- maps notification to user via `originalTransactionId` or `transactionId` in DB
- if `data.signedTransactionInfo` exists, updates subscription state and entitlements
- logs all notifications in `iap_notification_log`

## Notes
- Apple id token verification uses Apple JWKS at `https://appleid.apple.com/auth/keys`. (Apple docs)
- Google id token verification enforces issuer = `accounts.google.com` or `https://accounts.google.com` and audience = your GOOGLE_CLIENT_ID. (Google docs)
