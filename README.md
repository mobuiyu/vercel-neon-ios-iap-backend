# Next.js 16 + Vercel + Neon IAP Backend

This repo is **fully compatible with Vercel using Next.js App Router**.

## Important
- Uses `src/app/api/**/route.ts`
- No `pages/` directory
- `runtime = "nodejs"` for crypto compatibility

## Deploy
1. Run schema.sql on Neon
2. Set env vars on Vercel:
   - DATABASE_URL
   - APPLE_BUNDLE_ID
3. Deploy

## Test
curl https://YOUR_DOMAIN.vercel.app/api/iap/status?userId=test
