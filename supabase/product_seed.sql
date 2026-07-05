-- Product seed for 親のもしもナビ v0.3
-- Run after schema.sql.

insert into products (key, name, product_type, price_yen, billing_period, active, metadata) values
(
  'support_pack_basic',
  '発動サポートパック Basic',
  'support_pack',
  29800,
  null,
  true,
  '{"stripe_price_env":"STRIPE_SUPPORT_PACK_PRICE_ID","description":"人的レビュー、家族会議用レポート、相談先カテゴリ整理"}'::jsonb
),
(
  'family_plus_monthly',
  'Family Plus Monthly',
  'subscription',
  null,
  'monthly',
  false,
  '{"iap_planned":true,"description":"家族共有、期限リマインド、写真容量拡張など。アプリ内デジタル機能のためIAP前提で後続検討"}'::jsonb
)
on conflict (key) do update set
  name = excluded.name,
  product_type = excluded.product_type,
  price_yen = excluded.price_yen,
  billing_period = excluded.billing_period,
  active = excluded.active,
  metadata = excluded.metadata;
