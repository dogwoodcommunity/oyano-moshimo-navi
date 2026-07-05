# 環境変数マトリクス

## Web / Vercel

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | no | Next.js APIからDB/Storageへ安全に書き込む |
| `ADMIN_ACCESS_TOKEN` | yes | no | Admin API簡易保護 |
| `STRIPE_SECRET_KEY` | support pack時 | no | Stripe Checkout作成 |
| `STRIPE_SUPPORT_PACK_PRICE_ID` | support pack時 | no | 発動サポートパックPrice |
| `STRIPE_WEBHOOK_SECRET` | support pack時 | no | Stripe Webhook署名検証 |
| `CRON_SECRET` | notification時 | no | Cron手動実行保護 |
| `NEXT_PUBLIC_APP_SCHEME` | yes | yes | アプリ引き継ぎURL |
| `NEXT_PUBLIC_WEB_BASE_URL` | yes | yes | Web本番URL |

## Mobile / Expo EAS

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `EXPO_PUBLIC_APP_SCHEME` | yes | yes | deep link scheme |
| `EXPO_PUBLIC_WEB_BASE_URL` | yes | yes | handoff API呼び出し元Web URL |

## Supabase Auth Redirect URLs

Supabase Dashboard > Authentication > URL Configuration に設定する。

開発:

```txt
oyanomoshimo://
exp://127.0.0.1:8081
http://localhost:3000
```

本番:

```txt
oyanomoshimo://
https://<web-domain>
```

## 注意

- `SUPABASE_SERVICE_ROLE_KEY` は絶対に `NEXT_PUBLIC_` / `EXPO_PUBLIC_` にしない。
- `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` はWebサーバーだけに置く。
- Expoアプリ内に外部Web決済CTAを置かない。
