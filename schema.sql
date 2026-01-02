-- Run in Neon SQL Editor

create table if not exists app_user (
  id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists iap_product (
  product_id text primary key,
  kind text not null check (kind in ('consumable','non_consumable','subscription')),
  entitlements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists iap_transaction (
  id bigserial primary key,
  user_id text not null references app_user(id),
  product_id text not null,
  kind text not null check (kind in ('consumable','non_consumable','subscription')),
  transaction_id text not null unique,
  original_transaction_id text,
  purchase_date timestamptz,
  expires_date timestamptz,
  revocation_date timestamptz,
  environment text,
  status text not null default 'active', -- active / expired / revoked
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_iap_transaction_user on iap_transaction(user_id);
create index if not exists idx_iap_transaction_orig on iap_transaction(original_transaction_id);

create table if not exists iap_subscription_state (
  original_transaction_id text primary key,
  user_id text not null references app_user(id),
  product_id text not null,
  status text not null, -- active / expired / revoked
  expires_date timestamptz,
  last_transaction_id text,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists user_entitlement (
  user_id text not null references app_user(id),
  product_id text not null,
  granted_at timestamptz not null default now(),
  source_transaction_id text,
  meta jsonb not null default '{}'::jsonb,
  primary key (user_id, product_id)
);

create table if not exists user_ledger (
  transaction_id text primary key,
  user_id text not null references app_user(id),
  product_id text not null,
  delta integer not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Notifications log (v2)
create table if not exists iap_notification_log (
  id bigserial primary key,
  notification_uuid text unique,
  notification_type text,
  subtype text,
  environment text,
  original_transaction_id text,
  transaction_id text,
  mapped_user_id text,
  processed boolean not null default false,
  error text,
  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_iap_notif_otid on iap_notification_log(original_transaction_id);
create index if not exists idx_iap_notif_user on iap_notification_log(mapped_user_id);
