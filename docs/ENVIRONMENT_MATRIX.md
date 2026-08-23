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
| `ANTHROPIC_API_KEY` | 長期相談時 | no | `/api/consult` からClaude APIを呼ぶ |
| `CONSULT_CLIENT_DAILY_LIMIT` | 任意 | no | 利用者ごとの相談回数/日。既定5 |
| `CONSULT_DAILY_LIMIT` | 任意 | no | サービス全体の相談回数/日。既定50。想定外の請求を防ぐ緊急上限 |
| `CONSULT_MAX_OUTPUT_TOKENS` | 任意 | no | AI相談1回答の最大出力。既定1,600、コード側上限2,000 |
| `CONSULT_FAST_MODE` | 任意 | no | `1` で出力を最大2.5倍速に。料金は2倍。使えない環境では通常速度へ自動で落ちる |
| `NEXT_PUBLIC_IOS_APP_URL` | 公開後 | no | Web入口からApp Storeへ送る。未設定なら導線を出さない |
| `NEXT_PUBLIC_ANDROID_APP_URL` | 公開後 | no | 同上（Google Play） |
| `STRIPE_PLUS_PRICE_ID` | Plus提供時 | no | 継続課金のprice。未設定なら `/api/stripe/plus-checkout` は503 |
| `NEXT_PUBLIC_PLUS_PRICE_LABEL` | Plus提供時 | no | `/plans` の価格表示。未設定なら「準備中」 |
| `REVENUECAT_WEBHOOK_SECRET` | App内課金時 | no | `/api/revenuecat/webhook` の認証。未設定なら501 |
| `NEXT_PUBLIC_APP_SCHEME` | yes | yes | アプリ引き継ぎURL |
| `NEXT_PUBLIC_WEB_BASE_URL` | yes | yes | Web本番URL |

## Mobile / Expo EAS

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `EXPO_PUBLIC_APP_SCHEME` | yes | yes | deep link scheme |
| `EXPO_PUBLIC_WEB_BASE_URL` | yes | yes | handoff API呼び出し元Web URL |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | push通知時 | yes | Expo Push Token取得用のEAS projectId |

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
- `ANTHROPIC_API_KEY` もWebサーバーだけに置く。未設定の場合、長期相談は503を返し、手帳の他の機能は通常どおり動く。
- Expoアプリ内に外部Web決済CTAを置かない。
