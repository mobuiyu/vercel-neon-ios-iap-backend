create table if not exists app_user (
  id text primary key,
  created_at timestamptz default now()
);
create table if not exists iap_transaction (
  id bigserial primary key,
  user_id text references app_user(id),
  product_id text,
  transaction_id text unique,
  raw jsonb,
  created_at timestamptz default now()
);
