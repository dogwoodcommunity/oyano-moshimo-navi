# 環境変数マトリクス

## Web / Vercel

| Key | Required | Public | 用途 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | no | Next.js APIからDB/Storageへ安全に書き込む |
| `ADMIN_ACCESS_TOKEN` | yes | no | Admin API簡易保護 |
| `ACCOUNT_ERASURE_EXECUTION_ENABLED` | 削除運用開始時 | no | Auth・DB・Storageの完全削除を許可する最終スイッチ。通常は `false`。登録済みapp_adminのBearer認証だけが実行可能 |
| `COMMERCIAL_SUPPORT_PACK_SALES_ENABLED` | 有料提供時 | no | `true` の場合だけ発動サポートパック受付を開く最終スイッチ。通常は `false` |
| `COMMERCIAL_PLUS_SALES_ENABLED` | Plus提供時 | no | `true` の場合だけPlus受付を開く最終スイッチ。通常は `false` |
| `STRIPE_SECRET_KEY` | support pack時 | no | Stripe Checkout作成 |
| `STRIPE_SUPPORT_PACK_PRICE_ID` | support pack時 | no | 発動サポートパックPrice |
| `STRIPE_WEBHOOK_SECRET` | support pack時 | no | Stripe Webhook署名検証 |
| `CRON_SECRET` | notification時 | no | Cron手動実行保護 |
| `RESEND_API_KEY` | メール通知時 | no | 期限・月1確認メールをResend APIから送信 |
| `NOTIFICATION_EMAIL_FROM` | メール通知時 | no | Resendで認証済みの送信元。表示名つき形式も可 |
| `NOTIFICATION_EMAIL_REPLY_TO` | 任意 | no | 通知メールへの返信を受ける窓口 |
| `ANTHROPIC_API_KEY` | 長期相談時 | no | `/api/consult` からClaude APIを呼ぶ |
| `CONSULT_CLIENT_DAILY_LIMIT` | 任意 | no | 端末/IPごとの原価安全上限。既定5。無料枠の1日1回はDBで家族単位に別途原子的に制御 |
| `CONSULT_FAMILY_MONTHLY_LIMIT` | 任意 | no | Family Plusの相談成功回数/月。既定30。家族単位で判定 |
| `CONSULT_DAILY_LIMIT` | 任意 | no | サービス全体の相談回数/日。既定50。想定外の請求を防ぐ緊急上限 |
| `CONSULT_MAX_OUTPUT_TOKENS` | 任意 | no | AI相談1回答の最大出力。既定1,600、コード側上限2,000 |
| `CONSULT_FAST_MODE` | 任意 | no | `1` で出力を最大2.5倍速に。料金は2倍。使えない環境では通常速度へ自動で落ちる |
| `NEXT_PUBLIC_IOS_APP_URL` | 公開後 | no | Web入口からApp Storeへ送る。未設定なら導線を出さない |
| `NEXT_PUBLIC_ANDROID_APP_URL` | 公開後 | no | 同上（Google Play） |
| `STRIPE_PLUS_PRICE_ID` | Plus提供時 | no | 継続課金のprice。未設定なら `/api/stripe/plus-checkout` は503 |
| `NEXT_PUBLIC_PLUS_PRICE_LABEL` | Plus提供時 | no | `/plans` の価格表示。未設定なら「準備中」 |
| `LEGAL_BUSINESS_NAME` | 無料正式公開時 | no | 無料版の運営主体。有料時は特商法表示の正式な販売事業者名にも使う |
| `LEGAL_RESPONSIBLE_PERSON` | 無料正式公開時 | no | 個人情報管理・運営の責任者。有料時は特商法表示の責任者にも使う |
| `LEGAL_ADDRESS` | 有料提供時 | no | 特商法表示の所在地 |
| `LEGAL_PHONE` | 有料提供時 | no | 特商法表示の電話番号 |
| `LEGAL_PHONE_HOURS` | 有料提供時 | no | 電話の受付時間 |
| `LEGAL_CONTACT` | 無料正式公開時 | no | 利用者が実際に連絡できる問い合わせメールまたはフォームURL |
| `LEGAL_TERMS_EFFECTIVE_DATE` | 無料正式公開時 | no | 利用規約の施行日。例: `2026年10月1日` |
| `LEGAL_PRIVACY_EFFECTIVE_DATE` | 無料正式公開時 | no | プライバシーポリシーの施行日。例: `2026年10月1日` |
| `LEGAL_PRICE_DESCRIPTION` | 有料提供時 | no | 税込価格、自動更新周期など実際の販売価格説明 |
| `LEGAL_SERVICE_DELIVERY` | 有料提供時 | no | 決済後に機能・役務を提供する時期 |
| `LEGAL_CANCELLATION_POLICY` | 有料提供時 | no | 解約方法、次回更新停止、返金条件 |
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
- `ACCOUNT_ERASURE_EXECUTION_ENABLED` は `account_deletion_pipeline.sql` の適用、破棄DB回帰試験、管理者の削除手順確認がすべて終わるまで `false` のままにする。緊急用管理キーでは完全削除できない。
- `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` はWebサーバーだけに置く。
- 特商法用の `LEGAL_*` とStripeの必須設定がすべて揃い、対象の `COMMERCIAL_*_SALES_ENABLED=true` を明示するまでは、有料申込ボタンとCheckout APIを開かない。
- `ANTHROPIC_API_KEY` もWebサーバーだけに置く。未設定の場合、長期相談は503を返し、手帳の他の機能は通常どおり動く。
- `RESEND_API_KEY` と `NOTIFICATION_EMAIL_FROM` のどちらかが未設定なら、メール通知だけを停止し、端末通知は継続する。
- メール通知を有効にする前に `supabase/notification_email_delivery.sql` を本番DBへ適用する。未適用なら二重送信防止のためメールだけを停止する。
- Expoアプリ内に外部Web決済CTAを置かない。
